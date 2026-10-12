import asyncio
from datetime import date, timedelta

import httpx

from app.services import popular
from app.services.geocoding import OPENCAGE_URL
from app.services.popular import MemoryPopularStore, SqlitePopularStore

from .conftest import opencage_response, opencage_result

DAY = date(2026, 10, 12)
SINCE = DAY - timedelta(days=popular.WINDOW_DAYS - 1)


async def fill(store, scope: str, counts: dict[str, int], day: date = DAY) -> None:
    for city_id, count in counts.items():
        for _ in range(count):
            await store.record(day, [popular.ALL, scope], city_id, city_id.split("--")[0].title())


def test_time_zones_map_to_countries_including_old_aliases():
    assert popular.country_for_timezone("America/Chicago") == "US"
    assert popular.country_for_timezone("Asia/Calcutta") == "IN"
    assert popular.country_for_timezone("Europe/Lisbon") == "PT"
    assert popular.country_for_timezone("UTC") is None
    assert popular.country_for_timezone("") is None


def test_country_list_needs_enough_views_and_cities(monkeypatch):
    monkeypatch.setattr(popular, "today", lambda: DAY)

    async def run():
        store = MemoryPopularStore()
        # Four cities is not a list yet, and neither is a single person's handful of views.
        await fill(store, "US", {"lisbon--pt": 10, "denver--co--us": 10, "austin--tx--us": 3, "bali--id": 3})
        assert (await popular.popular_cities(store, "America/Chicago")).scope == "none"

        # A fifth city, plus one opened only once, which never makes the list.
        await fill(store, "US", {"medellin--co": 2, "tbilisi--ge": 1})
        result = await popular.popular_cities(store, "America/Chicago")
        assert result.scope == "country"
        assert result.country_code == "US"
        assert [c.id for c in result.cities] == [
            "lisbon--pt",
            "denver--co--us",
            "austin--tx--us",
            "bali--id",
            "medellin--co",
        ]

        # A visitor from a country without data gets the site-wide list.
        site = await popular.popular_cities(store, "Europe/Lisbon")
        assert site.scope == "site"
        assert len(site.cities) == 5

    asyncio.run(run())


def test_views_older_than_the_window_do_not_count(monkeypatch):
    monkeypatch.setattr(popular, "today", lambda: DAY)

    async def run():
        store = MemoryPopularStore()
        await fill(store, "US", {f"city{n}--us": 6 for n in range(5)}, day=DAY - timedelta(days=30))
        assert (await popular.popular_cities(store, "America/Chicago")).scope == "none"

    asyncio.run(run())


def test_sqlite_store_sums_days_keeps_names_and_survives_reopening(tmp_path):
    path = tmp_path / "popular.db"

    async def run():
        store = SqlitePopularStore(path)
        await store.record(DAY, ["ALL", "US"], "lisbon--pt", "Lisbon")
        await store.record(DAY - timedelta(days=3), ["ALL", "US"], "lisbon--pt", "Lisbon")
        await store.record(DAY, ["ALL"], "porto--pt", "Porto")
        # Old enough to fall out of the window, and pruned on the next write.
        await store.record(DAY - timedelta(days=40), ["ALL"], "bali--id", "Bali")
        await store.record(DAY, ["ALL"], "porto--pt", "Porto")

        reopened = SqlitePopularStore(path)
        assert await reopened.totals("US", SINCE) == ({"lisbon--pt": 2}, {"lisbon--pt": "Lisbon"})
        assert (await reopened.totals("ALL", SINCE))[0] == {"lisbon--pt": 2, "porto--pt": 2}
        assert (await reopened.totals("ALL", DAY - timedelta(days=60)))[0]["bali--id"] == 0

    asyncio.run(run())


def test_store_falls_back_to_memory_without_the_disk(tmp_path):
    assert isinstance(popular.create_popular_store(tmp_path / "missing" / "popular.db"), MemoryPopularStore)
    assert isinstance(popular.create_popular_store(None), MemoryPopularStore)
    assert isinstance(popular.create_popular_store(tmp_path / "popular.db"), SqlitePopularStore)


def test_unreadable_database_reads_as_no_data(tmp_path):
    async def run():
        store = SqlitePopularStore(tmp_path / "popular.db")
        store._path = tmp_path  # a folder, so every connection fails
        await store.record(DAY, ["ALL"], "lisbon--pt", "Lisbon")
        assert await store.totals("ALL", SINCE) == ({}, {})

    asyncio.run(run())


def test_view_endpoint_counts_the_resolved_city(client, mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(opencage_result()))
    )

    response = client.post("/api/views", json={"city_id": "santa-fe--nm--us", "time_zone": "America/Denver"})
    assert response.status_code == 204

    store = client.app.state.context.popular
    total, names = asyncio.run(store.totals("US", popular.today()))
    assert total == {"santa-fe--nm--us": 1}
    assert names == {"santa-fe--nm--us": "Santa Fe"}


def test_view_endpoint_rejects_bad_ids(client):
    assert client.post("/api/views", json={"city_id": "../../etc"}).status_code == 400


def test_popular_endpoint_without_data(client):
    response = client.get("/api/popular", params={"tz": "America/Chicago"})
    assert response.status_code == 200
    assert response.json() == {"scope": "none", "country_code": "", "cities": []}
