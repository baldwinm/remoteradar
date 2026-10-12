"""One shared HTTP client for every third-party API call.

Reusing a single client keeps TLS connections alive between requests, which saves a
handshake (often 100ms+) on every upstream call compared with bare `requests.get`.
"""

import logging
from typing import Any

import httpx

from .errors import UpstreamError

logger = logging.getLogger(__name__)

USER_AGENT = "RemoteRadar/2.0 (+https://remoteradar.net)"


def create_http_client(timeout_seconds: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(timeout_seconds, connect=5.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        # Retries only cover failures to connect, never a request the server received.
        transport=httpx.AsyncHTTPTransport(retries=1),
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        follow_redirects=False,
    )


async def request_json(client: httpx.AsyncClient, service: str, method: str, url: str, **kwargs: Any) -> Any:
    """Make a request and return the decoded JSON body, raising UpstreamError on any failure.

    Error messages deliberately leave out the URL: several providers take the API key
    as a query parameter, and the URL would leak it into logs.
    """
    try:
        response = await client.request(method, url, **kwargs)
    except httpx.TimeoutException as exc:
        raise UpstreamError(service, "request timed out") from exc
    except httpx.HTTPError as exc:
        raise UpstreamError(service, f"request failed: {type(exc).__name__}") from exc

    if response.status_code >= 400:
        raise UpstreamError(service, _error_snippet(response), status=response.status_code)

    try:
        return response.json()
    except ValueError as exc:
        raise UpstreamError(service, "response was not valid JSON", status=response.status_code) from exc


def _error_snippet(response: httpx.Response) -> str:
    text = response.text.strip().replace("\n", " ")
    return text[:300] if text else "empty error response"
