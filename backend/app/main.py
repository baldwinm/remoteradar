"""FastAPI application: the JSON API under /api, plus the built frontend when present."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .cache import CachedLoader, create_cache
from .config import Settings, get_settings
from .context import AppContext
from .errors import AppError, UpstreamError
from .http import create_http_client
from .routes import api
from .services import internet
from .services.popular import create_popular_store
from .web import SecurityHeadersMiddleware, mount_frontend

logger = logging.getLogger("remoteradar")

VERSION = "2.0.0"


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("remoteradar").setLevel(level.upper())
    # httpx logs every request URL at INFO, and some providers take the API key as a
    # query parameter. Keep those loggers quiet so keys never end up in the logs.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        cache = create_cache(settings.redis_url)
        http = create_http_client(settings.upstream_timeout_seconds)
        popular = create_popular_store(settings.stats_db_path)
        app.state.context = AppContext(
            settings=settings, http=http, cache=cache, loader=CachedLoader(cache), popular=popular
        )
        _warn_missing_keys(settings)
        # Load the bundled internet-speed tables now rather than on someone's first city visit.
        await asyncio.gather(*(asyncio.to_thread(internet.load_table, kind) for kind in ("fixed", "mobile")))
        try:
            yield
        finally:
            await http.aclose()
            await cache.close()
            await popular.close()

    docs = settings.is_development
    app = FastAPI(
        title="Remote Radar API",
        version=VERSION,
        lifespan=lifespan,
        docs_url="/api/docs" if docs else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs else None,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_methods=["GET"],
            allow_headers=["Accept", "Content-Type"],
            allow_credentials=False,
            max_age=3600,
        )
    app.add_middleware(SecurityHeadersMiddleware)

    _register_error_handlers(app)
    app.include_router(api.router, prefix="/api")
    # Render's health check and older monitors call /health without the /api prefix.
    app.add_api_route("/health", api.health, methods=["GET", "HEAD"], include_in_schema=False)

    if mount_frontend(app, settings.frontend_dist, settings.public_url):
        logger.info("Serving frontend from %s", settings.frontend_dist)
    else:
        logger.info("No frontend build at %s; serving the API only", settings.frontend_dist)

    return app


def _error(status: int, code: str, message: str, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        {"error": code, "message": message},
        status_code=status,
        headers={**(headers or {}), "Cache-Control": "no-store"},
    )


def _register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError) -> JSONResponse:
        if isinstance(exc, UpstreamError):
            logger.warning("Upstream failure on %s: %s", request.url.path, exc)
        elif exc.status_code >= 500:
            logger.error("%s on %s: %s", type(exc).__name__, request.url.path, exc)
        return _error(exc.status_code, exc.code, exc.public_message)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {404: "not_found", 405: "method_not_allowed", 429: "rate_limited"}
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        if exc.status_code == 404 and message == "Not Found":
            message = "Not found."
        return _error(exc.status_code, codes.get(exc.status_code, "http_error"), message, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = str(first.get("loc", ["", "request"])[-1])
        return _error(400, "invalid_request", f"Invalid value for '{field}'.")

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s", request.url.path)
        return _error(500, "internal_error", "Something went wrong. Please try again.")


def _warn_missing_keys(settings: Settings) -> None:
    for name, value in (
        ("OPENCAGE_API_KEY", settings.opencage_api_key),
        ("GOOGLE_API_KEY", settings.google_api_key),
        ("RAPIDAPI_KEY", settings.rapidapi_key),
    ):
        if not value:
            logger.warning("%s is not set; the features that need it will return 503", name)


app = create_app()
