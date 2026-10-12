"""Per-visitor rate limits, stored in the shared cache so all workers count together."""

import math
import time
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request

from .context import AppContext, get_context


def client_ip(request: Request) -> str:
    # Uvicorn/gunicorn are started with forwarded_allow_ips="*" (see gunicorn.conf.py),
    # so request.client already holds the visitor's address from X-Forwarded-For
    # rather than the hosting platform's load balancer.
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, requests: int, per_seconds: int) -> Callable[..., Awaitable[None]]:
    """FastAPI dependency allowing `requests` calls per `per_seconds` window per client IP."""

    async def check(request: Request, ctx: AppContext = Depends(get_context)) -> None:
        if not ctx.settings.rate_limits_enabled:
            return
        now = time.time()
        window = math.floor(now / per_seconds)
        count = await ctx.cache.incr(f"rl:{name}:{client_ip(request)}:{window}", per_seconds)
        if count > requests:
            retry_after = max(1, math.ceil((window + 1) * per_seconds - now))
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )

    return check
