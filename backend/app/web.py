"""Security headers, request logging, and serving the built frontend from the same origin."""

import logging
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .seo import city_page_html, sitemap_xml

logger = logging.getLogger("remoteradar.access")

# Third parties the page legitimately talks to: Mapbox (map tiles, styles, web workers),
# Google Fonts, GoatCounter analytics. Images come from Booking.com and map providers.
# The only outside script is GoatCounter's pinned count.v5.js (index.html also checks its hash).
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self' https://gc.zgo.at/count.v5.js",
        "style-src 'self' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com "
        "https://events.mapbox.com https://remoteradar.goatcounter.com",
        "worker-src 'self' blob:",
        "child-src blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
    ]
)

BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    # Other sites can't embed the API's JSON or the site's files in their own pages.
    "Cross-Origin-Resource-Policy": "same-origin",
}

# The API only ever receives small JSON bodies (POST /api/views is under 200 bytes).
MAX_BODY_BYTES = 16 * 1024

QUIET_PATHS = ("/api/health", "/health", "/assets/")


class SecurityHeadersMiddleware:
    """Adds security headers to every response and logs one line per request.

    Written as plain ASGI middleware (not BaseHTTPMiddleware) so it adds no per-request
    task overhead and works with streaming responses.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope["path"]
        started = time.perf_counter()
        status = 500

        async def send_with_headers(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = MutableHeaders(scope=message)
                for name, value in BASE_HEADERS.items():
                    headers.setdefault(name, value)
                if headers.get("content-type", "").startswith("text/html"):
                    headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
                if path.startswith("/api/") and "cache-control" not in headers:
                    headers["Cache-Control"] = "no-store"
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        finally:
            if not path.startswith(QUIET_PATHS):
                logger.info(
                    "%s %s %s %.0fms",
                    scope["method"],
                    path,
                    status,
                    (time.perf_counter() - started) * 1000,
                )


class MaxBodySizeMiddleware:
    """Rejects request bodies over MAX_BODY_BYTES before the app reads them into memory."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        length = dict(scope["headers"]).get(b"content-length")
        if length is not None and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            await _too_large(send)
            return

        # Chunked bodies have no length up front, so count as they arrive. (FastAPI may turn
        # the error into its own 400 when it's raised mid-parse; either way the body is refused.)
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_BODY_BYTES:
                    raise _BodyTooLargeError()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _BodyTooLargeError:
            await _too_large(send)


class _BodyTooLargeError(Exception):
    pass


async def _too_large(send: Send) -> None:
    body = b'{"error":"payload_too_large","message":"Request body too large."}'
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                (b"cache-control", b"no-store"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


def mount_frontend(app: FastAPI, dist: Path, public_url: str) -> bool:
    """Serve the built single-page app. Returns False when there is no build to serve."""
    dist = dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        return False

    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", ImmutableStaticFiles(directory=assets), name="assets")

    base_html = index.read_text(encoding="utf-8")
    sitemap = sitemap_xml(public_url)

    @app.get("/sitemap.xml", include_in_schema=False)
    async def sitemap_route() -> Response:
        return Response(
            sitemap, media_type="application/xml", headers={"Cache-Control": "public, max-age=86400"}
        )

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa(full_path: str, request: Request) -> Response:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found.")
        if full_path:
            candidate = (dist / full_path).resolve()
            if candidate.is_relative_to(dist) and candidate.is_file() and candidate != index:
                return FileResponse(candidate, headers={"Cache-Control": "public, max-age=86400"})
        # Any other path is a client-side route (e.g. /city/paris--idf--fr). City pages get
        # their own title and preview tags so search engines and link previews show the city.
        html = base_html
        if full_path.startswith("city/"):
            html = await city_page_html(request, base_html, full_path)
        return HTMLResponse(html, headers={"Cache-Control": "no-cache"})

    return True


class ImmutableStaticFiles(StaticFiles):
    """Vite puts a content hash in every asset filename, so they can be cached forever."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
