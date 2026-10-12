"""Long-lived objects shared by every request (created once at startup)."""

from dataclasses import dataclass

import httpx
from fastapi import Request

from .cache import Cache, CachedLoader
from .config import Settings


@dataclass
class AppContext:
    settings: Settings
    http: httpx.AsyncClient
    cache: Cache
    loader: CachedLoader


def get_context(request: Request) -> AppContext:
    return request.app.state.context
