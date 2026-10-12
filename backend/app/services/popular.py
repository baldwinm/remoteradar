"""Which cities people open most, overall and by the visitor's country.

Each city page view adds one to a daily total for (country, city) and for (all, city).
The country comes from the browser's time zone (America/Chicago -> US), never from the
IP address, and only those totals are stored: nothing ties a count to a person.

Totals live in a SQLite file (STATS_DB_PATH, by default data/popular.db at the repo root,
where the Render persistent disk is mounted) so they survive restarts and deploys. When that
folder doesn't exist they are kept in process memory, which is fine for development but
starts from zero after every restart.
"""

import asyncio
import json
import logging
import sqlite3
from collections import Counter
from contextlib import closing
from datetime import UTC, date, datetime, timedelta
from functools import cache
from pathlib import Path
from typing import Protocol

from ..models import PopularCities, PopularCity

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "timezone_countries.json"
ALL = "ALL"

WINDOW_DAYS = 30
LIST_SIZE = 5
# A list is shown only when it reflects more than a handful of people: at least
# MIN_TOTAL views in the window, spread over LIST_SIZE cities each opened MIN_CITY_VIEWS times.
MIN_TOTAL = 25
MIN_CITY_VIEWS = 2
# Cities read back per request; far more than a list needs, and it bounds the work.
TOP_LIMIT = 200
RESULT_TTL = 600


@cache
def _timezone_countries() -> dict[str, str]:
    return json.loads(DATA_FILE.read_text())


def country_for_timezone(time_zone: str) -> str | None:
    """ISO country code for an IANA time zone, or None for UTC and unknown zones."""
    return _timezone_countries().get(time_zone)


def today() -> date:
    return datetime.now(UTC).date()


class PopularStore(Protocol):
    async def record(self, day: date, scopes: list[str], city_id: str, name: str) -> None: ...

    async def totals(self, scope: str, since: date) -> tuple[Counter[str], dict[str, str]]:
        """Views per city id from `since` through today, and each city's display name."""
        ...

    async def close(self) -> None: ...


class MemoryPopularStore:
    def __init__(self) -> None:
        self._days: dict[tuple[date, str], Counter[str]] = {}
        self._names: dict[str, str] = {}

    async def record(self, day: date, scopes: list[str], city_id: str, name: str) -> None:
        for scope in scopes:
            self._days.setdefault((day, scope), Counter())[city_id] += 1
        self._names[city_id] = name
        cutoff = day - timedelta(days=WINDOW_DAYS + 1)
        for key in [key for key in self._days if key[0] < cutoff]:
            del self._days[key]

    async def totals(self, scope: str, since: date) -> tuple[Counter[str], dict[str, str]]:
        total: Counter[str] = Counter()
        for (day, day_scope), counts in self._days.items():
            if day_scope == scope and day >= since:
                total.update(counts)
        return total, {city_id: self._names.get(city_id, "") for city_id in total}

    async def close(self) -> None:
        self._days.clear()


class SqlitePopularStore:
    """Totals in a SQLite file, so they survive restarts and deploys (on Render, keep the file
    on a persistent disk). WAL mode lets every gunicorn worker read and write the same file.

    Failures are logged and swallowed: popular cities are a nicety and must never break a page.
    """

    def __init__(self, path: Path):
        self._path = path
        with closing(self._connect()) as db, db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute(
                "CREATE TABLE IF NOT EXISTS views (day TEXT NOT NULL, scope TEXT NOT NULL,"
                " city_id TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (day, scope, city_id))"
            )
            db.execute("CREATE TABLE IF NOT EXISTS names (city_id TEXT PRIMARY KEY, name TEXT NOT NULL)")

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self._path, timeout=5)
        db.execute("PRAGMA busy_timeout=5000")
        return db

    def _record(self, day: date, scopes: list[str], city_id: str, name: str) -> None:
        with closing(self._connect()) as db, db:
            db.executemany(
                "INSERT INTO views VALUES (?, ?, ?, 1)"
                " ON CONFLICT (day, scope, city_id) DO UPDATE SET count = count + 1",
                [(day.isoformat(), scope, city_id) for scope in scopes],
            )
            db.execute(
                "INSERT INTO names VALUES (?, ?) ON CONFLICT (city_id) DO UPDATE SET name = excluded.name",
                (city_id, name),
            )
            cutoff = day - timedelta(days=WINDOW_DAYS + 1)
            db.execute("DELETE FROM views WHERE day < ?", (cutoff.isoformat(),))

    def _totals(self, scope: str, since: date) -> tuple[Counter[str], dict[str, str]]:
        with closing(self._connect()) as db:
            rows = db.execute(
                "SELECT v.city_id, SUM(v.count), COALESCE(n.name, '') FROM views v"
                " LEFT JOIN names n ON n.city_id = v.city_id WHERE v.scope = ? AND v.day >= ?"
                " GROUP BY v.city_id ORDER BY 2 DESC LIMIT ?",
                (scope, since.isoformat(), TOP_LIMIT),
            ).fetchall()
        return Counter({city_id: total for city_id, total, _ in rows}), {
            city_id: name for city_id, _, name in rows
        }

    async def record(self, day: date, scopes: list[str], city_id: str, name: str) -> None:
        try:
            await asyncio.to_thread(self._record, day, scopes, city_id, name)
        except sqlite3.Error as exc:
            logger.warning("Recording a popular-city view failed: %s", exc)

    async def totals(self, scope: str, since: date) -> tuple[Counter[str], dict[str, str]]:
        try:
            return await asyncio.to_thread(self._totals, scope, since)
        except sqlite3.Error as exc:
            logger.warning("Reading popular cities failed: %s", exc)
            return Counter(), {}

    async def close(self) -> None:
        return None


def create_popular_store(path: Path | None) -> PopularStore:
    if path and path.parent.is_dir():
        try:
            store = SqlitePopularStore(path)
            logger.info("Keeping popular-city totals in %s", path)
            return store
        except sqlite3.Error as exc:
            logger.warning("Can't open %s for popular cities (%s); using memory", path, exc)
    logger.info("No stats disk; popular-city totals reset when the app restarts")
    return MemoryPopularStore()


async def record_view(store: PopularStore, city_id: str, name: str, time_zone: str) -> None:
    country = country_for_timezone(time_zone)
    await store.record(today(), [ALL, country] if country else [ALL], city_id, name)


def _pick(total: Counter[str], names: dict[str, str]) -> list[PopularCity]:
    eligible = [(city_id, count) for city_id, count in total.most_common() if count >= MIN_CITY_VIEWS]
    if sum(total.values()) < MIN_TOTAL or len(eligible) < LIST_SIZE:
        return []
    picked = [PopularCity(id=city_id, name=names[city_id]) for city_id, _ in eligible if names.get(city_id)]
    return picked[:LIST_SIZE] if len(picked) >= LIST_SIZE else []


async def popular_cities(store: PopularStore, time_zone: str) -> PopularCities:
    """The visitor's country list when it has enough data, else the site-wide list, else nothing
    (the frontend then keeps its built-in cities)."""
    since = today() - timedelta(days=WINDOW_DAYS - 1)
    country = country_for_timezone(time_zone)
    if country:
        cities = _pick(*await store.totals(country, since))
        if cities:
            return PopularCities(scope="country", country_code=country, cities=cities)
    cities = _pick(*await store.totals(ALL, since))
    if cities:
        return PopularCities(scope="site", cities=cities)
    return PopularCities(scope="none")
