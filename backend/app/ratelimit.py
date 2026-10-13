"""Per-visitor rate limits, stored in the shared cache so all workers count together.

Visitors are told apart by IP address, but the address itself is never stored: counters are
keyed by a keyed hash of it (see `visitor_key`), and each counter is dropped when its window
ends, so nothing outlives the minute it was counted in.
"""

import hashlib
import hmac
import ipaddress
import logging
import math
import secrets
import time
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request

from .context import AppContext, get_context

logger = logging.getLogger(__name__)

# Set at the edge by Cloudflare (which fronts Render) and overwritten there, so a visitor
# can't choose their value the way they can with X-Forwarded-For.
EDGE_IP_HEADERS = ("cf-connecting-ip", "true-client-ip")

_logged_source = False


def client_ip(request: Request) -> str:
    """The visitor's address, from headers a visitor can't forge where possible.

    X-Forwarded-For is a list the visitor can start with anything they like; proxies only
    append to it. So the first entry is never trusted: when no edge header is present, the
    nearest public address appended by a proxy (the rightmost public entry) is used.
    """
    headers = request.headers
    source = "socket"
    ip: str | None = None
    for name in EDGE_IP_HEADERS:
        if candidate := _valid_ip(headers.get(name, "")):
            ip, source = candidate, name
            break
    if ip is None:
        for entry in reversed(headers.get("x-forwarded-for", "").split(",")):
            candidate = _valid_ip(entry)
            if candidate and ipaddress.ip_address(candidate).is_global:
                ip, source = candidate, "x-forwarded-for"
                break
    if ip is None:
        ip = request.client.host if request.client else "unknown"
    _log_source_once(source)
    return ip


def _valid_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def _log_source_once(source: str) -> None:
    # Says which header visitors are told apart by (never the address), so a deploy shows
    # in the logs whether the platform's headers arrived as expected.
    global _logged_source
    if not _logged_source:
        _logged_source = True
        logger.info("Rate limits identify visitors by %s", source)


def visitor_key(ctx: AppContext, request: Request) -> str:
    """A short keyed hash of the visitor's IP, so counters never hold the address itself."""
    digest = hmac.new(ctx.ip_hash_key, client_ip(request).encode(), hashlib.sha256)
    return digest.hexdigest()[:20]


def new_ip_hash_key(configured: str) -> bytes:
    return configured.encode() if configured else secrets.token_bytes(32)


async def over_limit(ctx: AppContext, request: Request, name: str, requests: int, per_seconds: int) -> int:
    """Count one request; returns 0 when allowed, else the seconds until the window resets."""
    now = time.time()
    window = math.floor(now / per_seconds)
    remaining = max(1, math.ceil((window + 1) * per_seconds - now))
    # The counter expires when its window ends, never later.
    count = await ctx.cache.incr(f"rl:{name}:{visitor_key(ctx, request)}:{window}", remaining)
    return remaining if count > requests else 0


def rate_limit(name: str, requests: int, per_seconds: int) -> Callable[..., Awaitable[None]]:
    """FastAPI dependency allowing `requests` calls per `per_seconds` window per visitor."""

    async def check(request: Request, ctx: AppContext = Depends(get_context)) -> None:
        if not ctx.settings.rate_limits_enabled:
            return
        retry_after = await over_limit(ctx, request, name, requests, per_seconds)
        if retry_after:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )

    return check
