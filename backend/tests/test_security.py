"""Hardening: visitor identification, IP privacy in counters, spending caps, request limits."""

import asyncio
import time
from datetime import UTC, datetime

import httpx
from fastapi.testclient import TestClient

from app.cache import MemoryCache
from app.main import create_app
from app.services.geocoding import OPENCAGE_URL
from app.services.places import SEARCH_NEARBY_URL, SEARCH_TEXT_URL
from app.usage import Cap, UsageCapReachedError, UsageMeter

from .conftest import make_settings, opencage_response, opencage_result


def _search_burst(client, headers, n=60):
    for _ in range(n):
        client.get("/api/cities", params={"q": "xxxxx"}, headers=headers)
    return client.get("/api/cities", params={"q": "xxxxx"}, headers=headers).status_code


def test_spoofed_forwarded_for_does_not_dodge_rate_limits(mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    with TestClient(create_app(make_settings())) as client:
        for i in range(60):
            # A new made-up first entry each time; the proxy-appended address stays the same.
            # Private entries (a platform proxy's own hop) are skipped too.
            headers = {"X-Forwarded-For": f"1.2.3.{i}, 52.10.20.30, 10.0.0.{i}"}
            client.get("/api/cities", params={"q": "xxxxx"}, headers=headers)
        spoofed = {"X-Forwarded-For": "5.6.7.8, 52.10.20.30"}
        assert client.get("/api/cities", params={"q": "xxxxx"}, headers=spoofed).status_code == 429


def test_edge_header_identifies_the_visitor(mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    with TestClient(create_app(make_settings())) as client:
        assert _search_burst(client, {"CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "9.9.9.9"}) == 429
        other = {"CF-Connecting-IP": "203.0.113.8", "X-Forwarded-For": "9.9.9.9"}
        assert client.get("/api/cities", params={"q": "xxxxx"}, headers=other).status_code == 200


def test_rate_limit_counters_never_hold_the_ip_and_expire_with_the_window(mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    app = create_app(make_settings())
    with TestClient(app) as client:
        client.get("/api/cities", params={"q": "xxxxx"}, headers={"CF-Connecting-IP": "203.0.113.77"})
        cache: MemoryCache = app.state.context.cache
        keys = [key for key in cache._counters if key.startswith("rl:")]
        assert keys
        assert not any("203.0.113.77" in key for key in keys)
        assert all(
            expires - time.monotonic() <= 60 for key, (expires, _) in cache._counters.items() if key in keys
        )


def test_sweep_drops_expired_counters():
    async def scenario():
        cache = MemoryCache()
        await cache.incr("rl:a", -1)
        await cache.incr("rl:b", 60)
        cache.sweep()
        assert list(cache._counters) == ["rl:b"]

    asyncio.run(scenario())


def test_usage_meter_daily_cap_is_shared_through_sqlite(tmp_path):
    async def scenario():
        caps = {"google_places": Cap(per_minute=0, per_day=2)}
        first = UsageMeter(MemoryCache(), caps, tmp_path / "popular.db")
        second = UsageMeter(MemoryCache(), caps, tmp_path / "popular.db")  # another worker
        await first.spend("google_places")
        await second.spend("google_places")
        try:
            await first.spend("google_places")
        except UsageCapReachedError:
            return True
        return False

    assert asyncio.run(scenario())


def test_usage_meter_minute_cap_and_unknown_providers():
    async def scenario():
        meter = UsageMeter(MemoryCache(), {"opencage": Cap(per_minute=1, per_day=0)})
        await meter.spend("opencage")
        await meter.spend("something-else")  # no cap configured
        try:
            await meter.spend("opencage")
        except UsageCapReachedError:
            return True
        return False

    assert asyncio.run(scenario())


def test_places_stop_calling_google_once_the_daily_cap_is_spent(mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(opencage_result()))
    )
    nearby = mock_upstream.post(SEARCH_NEARBY_URL).mock(return_value=httpx.Response(200, json={"places": []}))
    text = mock_upstream.post(SEARCH_TEXT_URL).mock(return_value=httpx.Response(200, json={"places": []}))
    with TestClient(create_app(make_settings(google_places_daily_limit=3))) as client:
        assert client.get("/api/cities/santa-fe--nm--us/places").status_code == 200
        response = client.get("/api/cities/santa-fe--nm--us/places", params={"type": "gym"})
        assert response.status_code == 503
        assert response.json()["error"] == "service_unavailable"
    assert nearby.call_count + text.call_count == 3


def test_unknown_city_ids_are_remembered(client, mock_upstream):
    route = mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    assert client.get("/api/cities/nowhere-at-all--zz").status_code == 404
    assert client.get("/api/cities/nowhere-at-all--zz").status_code == 404
    assert route.call_count == 1


def test_large_request_bodies_are_refused(client):
    response = client.post(
        "/api/views",
        content=b'{"city_id": "' + b"a" * 20000 + b'"}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.headers["x-content-type-options"] == "nosniff"


def test_chunked_large_bodies_are_refused(client):
    def chunks():
        for _ in range(20):
            yield b"a" * 1024

    response = client.post("/api/views", content=chunks(), headers={"Content-Type": "application/json"})
    assert response.status_code in (400, 413)


def test_extra_security_headers(client):
    response = client.get("/api/health")
    assert response.headers["cross-origin-resource-policy"] == "same-origin"


def test_daily_counter_in_memory_expires_at_midnight():
    async def scenario():
        meter = UsageMeter(MemoryCache(), {"booking": Cap(per_minute=0, per_day=5)})
        await meter.spend("booking")
        day = datetime.now(UTC).date().isoformat()
        expires, count = meter._cache._counters[f"usage:booking:{day}"]
        return count, expires - time.monotonic()

    count, seconds_left = asyncio.run(scenario())
    assert count == 1
    assert 0 < seconds_left <= 86400


def test_page_policy_allows_no_inline_code_and_only_the_pinned_analytics_script():
    from app.web import CONTENT_SECURITY_POLICY

    directives = dict(part.split(" ", 1) for part in CONTENT_SECURITY_POLICY.split("; ") if " " in part)
    assert "'unsafe-inline'" not in CONTENT_SECURITY_POLICY
    assert directives["script-src"] == "'self' https://gc.zgo.at/count.v5.js"
