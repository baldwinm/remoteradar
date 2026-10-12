"""Essentials (currency, holidays, advisory, internet), climate, stay dates and extra place types."""

import json
from datetime import UTC, date, datetime, timedelta

import httpx
import pytest

from app.services.climate import ARCHIVE_URL, monthly_averages
from app.services.essentials import ADVISORIES_URL, RATES_URL, normalize_country
from app.services.geocoding import OPENCAGE_URL
from app.services.places import SEARCH_NEARBY_URL, SEARCH_TEXT_URL
from app.services.stays import AUTOCOMPLETE_URL, PROPERTIES_URL

from .conftest import opencage_response, opencage_result

LISBON_ID = "lisbon--pt"
LISBON = opencage_result(
    name="Lisbon",
    state="Lisbon",
    state_code="",
    country="Portugal",
    country_code="pt",
    lat=38.7223,
    lng=-9.1393,
    timezone="Europe/Lisbon",
    currency={"iso_code": "EUR", "symbol": "€", "name": "Euro"},
)
HOLIDAYS_PT = "https://date.nager.at/api/v3/PublicHolidays/{year}/PT"


@pytest.fixture(autouse=True)
def geocoder(mock_upstream):
    return mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(LISBON))
    )


def mock_essentials_sources(router, holidays=None, advisories=None, rates=None):
    router.get(RATES_URL).mock(
        return_value=rates
        or httpx.Response(
            200,
            json={
                "result": "success",
                "time_last_update_utc": "Mon, 12 Oct 2026",
                "rates": {"USD": 1, "EUR": 0.92},
            },
        )
    )
    today = datetime.now(UTC).date()
    soon = (today + timedelta(days=10)).isoformat()
    later = (today + timedelta(days=200)).isoformat()
    default_holidays = [
        {"date": soon, "localName": "Dia X", "name": "Day X", "global": True},
        {"date": soon, "localName": "Regional", "name": "Regional Day", "global": False},
        {"date": later, "localName": "Far", "name": "Far Away Day", "global": True},
    ]
    for year in {today.year, (today + timedelta(days=60)).year}:
        router.get(HOLIDAYS_PT.format(year=year)).mock(
            return_value=holidays or httpx.Response(200, json=default_holidays)
        )
    router.get(ADVISORIES_URL).mock(
        return_value=advisories
        or httpx.Response(
            200,
            json=[
                {
                    "Title": "Portugal - Level 1: Exercise Normal Precautions",
                    "Link": "https://travel.state.gov/portugal",
                    "Updated": "2026-07-01",
                },
                {"Title": "Burma - Level 4: Do Not Travel", "Link": "https://travel.state.gov/burma"},
            ],
        )
    )


def test_essentials_combine_every_source(client, mock_upstream):
    mock_essentials_sources(mock_upstream)

    response = client.get(f"/api/cities/{LISBON_ID}/essentials")

    assert response.status_code == 200
    data = response.json()
    assert data["timezone"] == "Europe/Lisbon"
    assert data["currency"]["code"] == "EUR"
    assert data["currency"]["symbol"] == "€"
    assert data["currency"]["usd_rate"] == 0.92
    assert [h["name"] for h in data["holidays"]] == ["Day X"]
    assert data["advisory"]["level"] == 1
    assert data["advisory"]["url"] == "https://travel.state.gov/portugal"
    # Shipped Ookla data covers Lisbon.
    assert data["internet"]["fixed"]["download_mbps"] > 0
    assert data["internet"]["period"]
    assert data["partial"] is False


def test_essentials_survive_a_failing_source(client, mock_upstream):
    mock_essentials_sources(mock_upstream, advisories=httpx.Response(500, text="down"))
    data = client.get(f"/api/cities/{LISBON_ID}/essentials").json()
    assert data["advisory"] is None
    assert data["partial"] is True
    assert data["currency"]["usd_rate"] == 0.92


def test_essentials_treat_unsupported_holiday_country_as_no_data(client, mock_upstream):
    mock_essentials_sources(mock_upstream, holidays=httpx.Response(404))
    data = client.get(f"/api/cities/{LISBON_ID}/essentials").json()
    assert data["holidays"] is None
    assert data["partial"] is False


def test_advisory_country_names_match_state_department_spelling():
    assert normalize_country("Côte d'Ivoire") == "cote d ivoire"
    assert normalize_country("Türkiye") == "turkiye"


def climate_payload():
    times, highs, lows, rain, sun = [], [], [], [], []
    day = date(2021, 1, 1)
    while day.year < 2026:
        times.append(day.isoformat())
        # Hot, dry summers; cool, wet winters; mild, showery spring and autumn.
        summer = day.month in (6, 7, 8)
        highs.append(34.0 if summer else 15.0 if day.month in (12, 1, 2) else 24.0)
        lows.append(highs[-1] - 8)
        rain.append(0.0 if summer else 3.0 if day.day % 2 else 0.0)
        sun.append(36000.0)
        day += timedelta(days=1)
    return {
        "daily": {
            "time": times,
            "temperature_2m_max": highs,
            "temperature_2m_min": lows,
            "precipitation_sum": rain,
            "sunshine_duration": sun,
        }
    }


def test_climate_monthly_averages_and_best_months():
    months = monthly_averages(climate_payload())
    assert len(months) == 12
    january, may = months[0], months[4]
    assert january["temperature_max"] == 15.0
    assert january["rainy_days"] == 16.0  # odd days of a 31-day month
    assert january["precipitation"] == 48.0
    assert may["sunshine_hours"] == 10.0
    # 24°C months with the fewest rainy days win: April, September and November have 15, May and October 16.
    assert [m["month"] for m in months if m["best"]] == [4, 9, 11]


def test_climate_endpoint_converts_units_from_one_cached_call(client, mock_upstream):
    route = mock_upstream.get(ARCHIVE_URL).mock(return_value=httpx.Response(200, json=climate_payload()))

    metric = client.get(f"/api/cities/{LISBON_ID}/climate").json()
    imperial = client.get(f"/api/cities/{LISBON_ID}/climate", params={"units": "imperial"}).json()

    assert route.call_count == 1
    assert metric["months"][0]["temperature_max"] == 15.0
    assert imperial["months"][0]["temperature_max"] == 59.0
    assert imperial["units"] == "imperial"
    last_year = datetime.now(UTC).year - 1
    assert metric["years"] == f"{last_year - 4}-{last_year}"
    params = route.calls.last.request.url.params
    assert params["start_date"] == f"{last_year - 4}-01-01"


def test_stays_take_checkin_and_nights(client, mock_upstream):
    mock_upstream.get(AUTOCOMPLETE_URL).mock(return_value=httpx.Response(200, json=[{"dest_id": "1"}]))
    properties = mock_upstream.get(PROPERTIES_URL).mock(return_value=httpx.Response(200, json={"result": []}))
    checkin = datetime.now(UTC).date() + timedelta(days=20)

    response = client.get(
        f"/api/cities/{LISBON_ID}/stays", params={"checkin": checkin.isoformat(), "nights": 30}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["nights"] == 30
    assert data["checkout"] == (checkin + timedelta(days=30)).isoformat()
    assert properties.calls.last.request.url.params["departure_date"] == data["checkout"]


@pytest.mark.parametrize(
    "params",
    [
        {"checkin": "2020-01-01"},
        {"checkin": (datetime.now(UTC).date() + timedelta(days=400)).isoformat()},
        {"nights": 31},
        {"checkin": "not-a-date"},
    ],
)
def test_stays_reject_bad_dates(client, mock_upstream, params):
    response = client.get(f"/api/cities/{LISBON_ID}/stays", params=params)
    assert response.status_code == 400


def test_extra_place_types_are_fetched_on_demand_with_hours(client, mock_upstream):
    nearby = mock_upstream.post(SEARCH_NEARBY_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "places": [
                    {
                        "id": "g1",
                        "displayName": {"text": "Lift Lisboa"},
                        "regularOpeningHours": {
                            "periods": [
                                {
                                    "open": {"day": 1, "hour": 6, "minute": 30},
                                    "close": {"day": 1, "hour": 22},
                                },
                                {"open": {"day": 0, "hour": 0, "minute": 0}},
                            ]
                        },
                    }
                ]
            },
        )
    )
    text = mock_upstream.post(SEARCH_TEXT_URL)

    data = client.get(f"/api/cities/{LISBON_ID}/places", params={"type": "gym"}).json()

    assert nearby.call_count == 1
    assert text.call_count == 0
    assert json.loads(nearby.calls.last.request.content)["includedTypes"] == ["gym", "fitness_center"]
    assert "regularOpeningHours.periods" in nearby.calls.last.request.headers["X-Goog-FieldMask"]
    assert data["counts"]["gym"] == 1
    gym = data["places"][0]
    assert gym["type"] == "gym"
    assert gym["opening_hours"] == [
        {"open_day": 1, "open_minute": 390, "close_day": 1, "close_minute": 1320},
        {"open_day": 0, "open_minute": 0, "close_day": None, "close_minute": None},
    ]
