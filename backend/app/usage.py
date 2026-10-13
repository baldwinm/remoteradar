"""Site-wide caps on calls to the paid or quota-limited providers.

Per-visitor rate limits stop one person hammering the site, but someone with many addresses
(or a crawler fleet) could still open thousands of uncached cities and run up the Google,
OpenCage or RapidAPI bill. These caps bound the total: once a provider's daily budget is
spent, features that need a new lookup answer "temporarily unavailable" until the next UTC
day, while everything already cached keeps working.

Daily totals are kept in the same SQLite file as the popular-city counts (on the Render disk),
so every worker shares one count and a restart doesn't reset it. Without that file each
worker counts on its own in memory. Per-minute caps smooth out bursts and are per worker.
"""

import asyncio
import logging
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from .cache import Cache
from .errors import AppError

logger = logging.getLogger(__name__)


class UsageCapReachedError(AppError):
    status_code = 503
    code = "service_unavailable"
    public_message = "This feature is temporarily unavailable. Please try again later."


@dataclass(frozen=True)
class Cap:
    per_minute: int
    # 0 means no daily cap.
    per_day: int


class UsageMeter:
    def __init__(self, cache: Cache, caps: dict[str, Cap], db_path: Path | None = None):
        self._cache = cache
        self._caps = caps
        self._db_path = db_path if db_path and db_path.parent.is_dir() else None
        if self._db_path:
            try:
                with closing(self._connect()) as db, db:
                    db.execute(
                        "CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, provider TEXT NOT NULL,"
                        " count INTEGER NOT NULL, PRIMARY KEY (day, provider))"
                    )
            except sqlite3.Error as exc:
                logger.warning("Can't keep provider usage in %s (%s); counting in memory", db_path, exc)
                self._db_path = None

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self._db_path, timeout=5)  # type: ignore[arg-type]
        db.execute("PRAGMA busy_timeout=5000")
        return db

    async def spend(self, provider: str) -> None:
        """Count one upstream call, or raise UsageCapReachedError when the provider's cap is spent."""
        cap = self._caps.get(provider)
        if cap is None:
            return
        now = datetime.now(UTC)
        minute = now.strftime("%Y%m%d%H%M")
        if cap.per_minute and await self._cache.incr(f"usage:{provider}:{minute}", 60) > cap.per_minute:
            logger.warning("%s per-minute cap (%d) reached", provider, cap.per_minute)
            raise UsageCapReachedError()
        if cap.per_day and await self._count_today(provider, now) > cap.per_day:
            logger.warning(
                "%s daily cap (%d) reached; new lookups paused until 00:00 UTC", provider, cap.per_day
            )
            raise UsageCapReachedError()

    async def _count_today(self, provider: str, now: datetime) -> int:
        day = now.date().isoformat()
        if self._db_path:
            try:
                return await asyncio.to_thread(self._incr_db, day, provider)
            except sqlite3.Error as exc:
                logger.warning("Counting %s usage failed (%s); counting in memory", provider, exc)
        midnight = datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), UTC)
        return await self._cache.incr(
            f"usage:{provider}:{day}", max(1, int((midnight - now).total_seconds()))
        )

    def _incr_db(self, day: str, provider: str) -> int:
        with closing(self._connect()) as db, db:
            (count,) = db.execute(
                "INSERT INTO usage VALUES (?, ?, 1) ON CONFLICT (day, provider)"
                " DO UPDATE SET count = count + 1 RETURNING count",
                (day, provider),
            ).fetchone()
            db.execute(
                "DELETE FROM usage WHERE day < ?",
                ((datetime.now(UTC).date() - timedelta(days=7)).isoformat(),),
            )
        return int(count)
