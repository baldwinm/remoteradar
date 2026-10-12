"""Long-lived objects shared by every request (created once at startup)."""

from dataclasses import dataclass

import httpx
from fastapi import Request

from .cache import Cache, CachedLoader
from .config import Settings
from .services.popular import PopularStore


@dataclass
class AppContext:
    settings: Settings
    http: httpx.AsyncClient
    cache: Cache
    loader: CachedLoader
    popular: PopularStore


def get_context(request: Request) -> AppContext:
    return request.app.state.context
