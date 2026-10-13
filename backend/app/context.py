"""Long-lived objects shared by every request (created once at startup)."""

from dataclasses import dataclass

import httpx
from fastapi import Request

from .cache import Cache, CachedLoader
from .config import Settings
from .services.popular import PopularStore
from .usage import UsageMeter


@dataclass
class AppContext:
    settings: Settings
    http: httpx.AsyncClient
    cache: Cache
    loader: CachedLoader
    popular: PopularStore
    usage: UsageMeter
    # Secret for hashing visitor IPs in rate-limit counters (see ratelimit.visitor_key).
    ip_hash_key: bytes


def get_context(request: Request) -> AppContext:
    return request.app.state.context
