"""Which cities people open most, overall and by the visitor's country.

Each city page view adds one to a daily total for (country, city) and for (all, city).
The country comes from the browser's time zone (America/Chicago -> US), never from the
IP address, and only those totals are stored: nothing ties a count to a person.

Totals live in Redis when STATS_REDIS_URL (or REDIS_URL) is set, so they survive restarts
and the free plan's sleep. Without Redis they are kept in process memory, which is fine
for development but starts from zero after every restart.
"""

import json
import logging
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from functools import cache
from pathlib import Path
from typing import Protocol

from ..models import PopularCities, PopularCity

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "timezone_countries.json"
REDIS_PREFIX = "rr:popular:"
ALL = "ALL"

WINDOW_DAYS = 30
LIST_SIZE = 5
# A list is shown only when it reflects more than a handful of people: at least
# MIN_TOTAL views in the window, spread over LIST_SIZE cities each opened MIN_CITY_VIEWS times.
MIN_TOTAL = 25
MIN_CITY_VIEWS = 2
# Each day keeps only its top cities when read back, which bounds the work per request.
PER_DAY_LIMIT = 100
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

    async def totals(self, scope: str, days: list[date]) -> tuple[Counter[str], dict[str, str]]:
        """Views per city id over `days`, and each city's display name."""
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

    async def totals(self, scope: str, days: list[date]) -> tuple[Counter[str], dict[str, str]]:
        total: Counter[str] = Counter()
        for day in days:
            total.update(dict(self._days.get((day, scope), Counter()).most_common(PER_DAY_LIMIT)))
        return total, {city_id: self._names.get(city_id, "") for city_id in total}

    async def close(self) -> None:
        self._days.clear()


class RedisPopularStore:
    """One sorted set per day and scope, expiring after the window, plus a hash of city names.

    Failures are logged and swallowed: popular cities are a nicety and must never break a page.
    """

    def __init__(self, url: str):
        from redis import asyncio as redis_asyncio

        self._redis = redis_asyncio.from_url(
            url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2, health_check_interval=30
        )

    @staticmethod
    def _key(day: date, scope: str) -> str:
        return f"{REDIS_PREFIX}{day.isoformat()}:{scope}"

    async def record(self, day: date, scopes: list[str], city_id: str, name: str) -> None:
        ttl = (WINDOW_DAYS + 2) * 86400
        try:
            async with self._redis.pipeline(transaction=False) as pipe:
                for scope in scopes:
                    pipe.zincrby(self._key(day, scope), 1, city_id)
                    pipe.expire(self._key(day, scope), ttl, nx=True)
                pipe.hset(f"{REDIS_PREFIX}names", city_id, name)
                await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Recording a popular-city view failed: %s", type(exc).__name__)

    async def totals(self, scope: str, days: list[date]) -> tuple[Counter[str], dict[str, str]]:
        total: Counter[str] = Counter()
        try:
            async with self._redis.pipeline(transaction=False) as pipe:
                for day in days:
                    pipe.zrange(self._key(day, scope), 0, PER_DAY_LIMIT - 1, desc=True, withscores=True)
                for city_id, score in (pair for rows in await pipe.execute() for pair in rows):
                    total[city_id] += int(score)
            names = await self._redis.hmget(f"{REDIS_PREFIX}names", list(total)) if total else []
        except Exception as exc:  # noqa: BLE001
            logger.warning("Reading popular cities failed: %s", type(exc).__name__)
            return Counter(), {}
        return total, {city_id: name or "" for city_id, name in zip(total, names, strict=True)}

    async def close(self) -> None:
        await self._redis.aclose()


def create_popular_store(url: str | None) -> PopularStore:
    if url:
        return RedisPopularStore(url)
    logger.info("No Redis URL for popular cities; counts reset when the app restarts")
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
    end = today()
    days = [end - timedelta(days=offset) for offset in range(WINDOW_DAYS)]
    country = country_for_timezone(time_zone)
    if country:
        cities = _pick(*await store.totals(country, days))
        if cities:
            return PopularCities(scope="country", country_code=country, cities=cities)
    cities = _pick(*await store.totals(ALL, days))
    if cities:
        return PopularCities(scope="site", cities=cities)
    return PopularCities(scope="none")
