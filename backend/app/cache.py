"""Response cache and counters, backed by Redis when available and process memory otherwise.

Values go through JSON in both backends, so code that works against the in-memory
cache in development behaves the same against Redis in production, and callers can
never mutate a cached object by accident.
"""

import asyncio
import json
import logging
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

logger = logging.getLogger(__name__)

# Bump when a cached shape changes, so old entries are ignored instead of misread.
KEY_PREFIX = "rr:v3:"


class Cache(Protocol):
    async def get(self, key: str) -> Any | None: ...

    async def set(self, key: str, value: Any, ttl: int) -> None: ...

    async def incr(self, key: str, ttl: int) -> int:
        """Increment a counter that expires `ttl` seconds after it was created."""
        ...

    async def close(self) -> None: ...


class MemoryCache:
    """A bounded, per-process TTL cache. Fine for a single worker or local development."""

    def __init__(self, max_entries: int = 5000):
        self._max_entries = max_entries
        self._values: OrderedDict[str, tuple[float, str]] = OrderedDict()
        self._counters: dict[str, tuple[float, int]] = {}

    async def get(self, key: str) -> Any | None:
        item = self._values.get(key)
        if item is None:
            return None
        expires_at, payload = item
        if expires_at <= time.monotonic():
            self._values.pop(key, None)
            return None
        self._values.move_to_end(key)
        return json.loads(payload)

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._values[key] = (time.monotonic() + ttl, json.dumps(value))
        self._values.move_to_end(key)
        while len(self._values) > self._max_entries:
            self._values.popitem(last=False)

    async def incr(self, key: str, ttl: int) -> int:
        now = time.monotonic()
        expires_at, count = self._counters.get(key, (now + ttl, 0))
        if expires_at <= now:
            expires_at, count = now + ttl, 0
        self._counters[key] = (expires_at, count + 1)
        if len(self._counters) > self._max_entries:
            self._counters = {k: v for k, v in self._counters.items() if v[0] > now}
        return count + 1

    async def close(self) -> None:
        self._values.clear()
        self._counters.clear()


class RedisCache:
    """Shared cache for multiple workers. Redis outages degrade to cache misses, not errors."""

    def __init__(self, url: str):
        from redis import asyncio as redis_asyncio

        self._redis = redis_asyncio.from_url(
            url,
            decode_responses=True,
            socket_timeout=2,
            socket_connect_timeout=2,
            health_check_interval=30,
        )

    async def get(self, key: str) -> Any | None:
        try:
            payload = await self._redis.get(KEY_PREFIX + key)
        except Exception as exc:  # noqa: BLE001 - any Redis failure is a cache miss
            logger.warning("Redis get failed: %s", type(exc).__name__)
            return None
        return None if payload is None else json.loads(payload)

    async def set(self, key: str, value: Any, ttl: int) -> None:
        try:
            await self._redis.set(KEY_PREFIX + key, json.dumps(value), ex=ttl)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis set failed: %s", type(exc).__name__)

    async def incr(self, key: str, ttl: int) -> int:
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.incr(KEY_PREFIX + key)
                pipe.expire(KEY_PREFIX + key, ttl, nx=True)
                count, _ = await pipe.execute()
            return int(count)
        except Exception as exc:  # noqa: BLE001 - fail open: never block users because Redis is down
            logger.warning("Redis incr failed: %s", type(exc).__name__)
            return 0

    async def close(self) -> None:
        await self._redis.aclose()


def create_cache(redis_url: str | None) -> Cache:
    if redis_url:
        logger.info("Using Redis for caching and rate limits")
        return RedisCache(redis_url)
    logger.info("REDIS_URL not set; using per-process memory for caching and rate limits")
    return MemoryCache()


class CachedLoader:
    """Read-through cache with request coalescing.

    When several requests miss the cache for the same key at once (for example the
    city page firing its weather, places and stays requests together), only one of
    them calls the upstream API and the rest wait for that result.
    """

    def __init__(self, cache: Cache):
        self.cache = cache
        self._inflight: dict[str, asyncio.Task[Any]] = {}

    async def get_or_load(self, key: str, ttl: int, loader: Callable[[], Awaitable[Any]]) -> Any:
        cached = await self.cache.get(key)
        if cached is not None:
            return cached

        task = self._inflight.get(key)
        if task is None:
            task = asyncio.create_task(self._load_and_store(key, ttl, loader))
            self._inflight[key] = task
            task.add_done_callback(lambda finished: self._finish(key, finished))
        # shield() lets the shared load finish even if this particular client disconnects.
        return await asyncio.shield(task)

    async def _load_and_store(self, key: str, ttl: int, loader: Callable[[], Awaitable[Any]]) -> Any:
        value = await loader()
        await self.cache.set(key, value, ttl)
        return value

    def _finish(self, key: str, task: asyncio.Task[Any]) -> None:
        self._inflight.pop(key, None)
        if not task.cancelled():
            task.exception()  # mark as retrieved so asyncio doesn't warn when nobody awaited it
