"""Cross-cutting behaviour: rate limits, caching backends, headers, static frontend."""

import asyncio

import fakeredis
import httpx
import pytest
from fastapi.testclient import TestClient

from app.cache import KEY_PREFIX, CachedLoader, MemoryCache, RedisCache
from app.main import create_app
from app.services.geocoding import OPENCAGE_URL
from app.web import CONTENT_SECURITY_POLICY

from .conftest import make_settings, opencage_response, opencage_result


def test_rate_limit_returns_429_with_retry_after(client, mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(opencage_result()))
    )
    statuses = [client.get("/api/cities/santa-fe--nm--us").status_code for _ in range(61)]
    assert statuses[:60] == [200] * 60
    assert statuses[60] == 429
    limited = client.get("/api/cities/santa-fe--nm--us")
    assert int(limited.headers["retry-after"]) >= 1
    assert limited.json()["error"] == "rate_limited"


def test_rate_limit_is_per_client_ip(mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    app = create_app(make_settings())
    with (
        TestClient(app, client=("203.0.113.1", 1234)) as first,
        TestClient(app, client=("203.0.113.2", 1234)) as second,
    ):
        for _ in range(60):
            first.get("/api/cities", params={"q": "x" * 5})
        assert first.get("/api/cities", params={"q": "xxxxx"}).status_code == 429
        assert second.get("/api/cities", params={"q": "xxxxx"}).status_code == 200


def test_security_headers_on_api(client):
    response = client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert "access-control-allow-origin" not in response.headers


def test_cors_only_for_configured_origins(mock_upstream):
    app = create_app(make_settings(cors_origins="https://remoteradar.net"))
    with TestClient(app) as client:
        allowed = client.get("/api/health", headers={"Origin": "https://remoteradar.net"})
        denied = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert allowed.headers["access-control-allow-origin"] == "https://remoteradar.net"
    assert "access-control-allow-credentials" not in allowed.headers
    assert "access-control-allow-origin" not in denied.headers


def test_no_cors_by_default(client):
    response = client.get("/api/health", headers={"Origin": "https://remoteradar.net"})
    assert "access-control-allow-origin" not in response.headers


def test_docs_hidden_in_production(client):
    assert client.get("/api/docs").status_code == 404
    assert client.get("/api/openapi.json").status_code == 404


def test_root_health_alias(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.fixture
def built_frontend(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log('hi')")
    (tmp_path / "index.html").write_text("<!doctype html><div id=root></div>")
    (tmp_path / "robots.txt").write_text("User-agent: *")
    (tmp_path.parent / "secret.txt").write_text("nope")
    return tmp_path


def test_serves_spa_with_csp_and_cache_headers(built_frontend, mock_upstream):
    with TestClient(create_app(make_settings(frontend_dist=built_frontend))) as client:
        page = client.get("/city/santa-fe--nm--us")
        asset = client.get("/assets/index-abc123.js")
        robots = client.get("/robots.txt")
        traversal = client.get("/..%2Fsecret.txt")
        api_404 = client.get("/api/unknown")

    assert page.status_code == 200
    assert "id=root" in page.text
    assert page.headers["content-security-policy"] == CONTENT_SECURITY_POLICY
    assert page.headers["cache-control"] == "no-cache"
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert robots.text == "User-agent: *"
    assert "nope" not in traversal.text
    assert api_404.status_code == 404
    assert api_404.headers["content-type"].startswith("application/json")


def test_memory_cache_expires_and_counts():
    async def scenario():
        cache = MemoryCache(max_entries=2)
        await cache.set("a", {"x": 1}, ttl=60)
        value = await cache.get("a")
        value["x"] = 2  # callers get a copy, not the cached object
        assert await cache.get("a") == {"x": 1}
        await cache.set("b", 1, ttl=60)
        await cache.set("c", 1, ttl=60)
        assert await cache.get("a") is None  # evicted (max 2 entries)
        await cache.set("gone", 1, ttl=-1)
        assert await cache.get("gone") is None
        assert [await cache.incr("n", 60) for _ in range(3)] == [1, 2, 3]

    asyncio.run(scenario())


def test_redis_cache_round_trip_and_counter_expiry():
    async def scenario():
        cache = RedisCache.__new__(RedisCache)
        cache._redis = fakeredis.FakeAsyncRedis(decode_responses=True)
        await cache.set("k", {"cities": [1, 2]}, ttl=60)
        assert await cache.get("k") == {"cities": [1, 2]}
        assert await cache.incr("hits", 60) == 1
        assert await cache.incr("hits", 60) == 2
        assert 0 < await cache._redis.ttl(f"{KEY_PREFIX}hits") <= 60

    asyncio.run(scenario())


def test_redis_outage_degrades_to_miss():
    class Broken:
        async def get(self, *a, **k):
            raise ConnectionError("down")

        async def set(self, *a, **k):
            raise ConnectionError("down")

    async def scenario():
        cache = RedisCache.__new__(RedisCache)
        cache._redis = Broken()
        assert await cache.get("k") is None
        await cache.set("k", 1, 60)  # does not raise

    asyncio.run(scenario())


def test_loader_coalesces_concurrent_misses():
    calls = 0

    async def slow_load():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        return {"value": calls}

    async def scenario():
        loader = CachedLoader(MemoryCache())
        results = await asyncio.gather(*(loader.get_or_load("k", 60, slow_load) for _ in range(5)))
        assert results == [{"value": 1}] * 5
        assert await loader.get_or_load("k", 60, slow_load) == {"value": 1}

    asyncio.run(scenario())
    assert calls == 1


def test_loader_does_not_cache_failures():
    attempts = 0

    async def flaky():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("first call fails")
        return "ok"

    async def scenario():
        loader = CachedLoader(MemoryCache())
        with pytest.raises(RuntimeError):
            await loader.get_or_load("k", 60, flaky)
        assert await loader.get_or_load("k", 60, flaky) == "ok"

    asyncio.run(scenario())


def test_city_pages_get_their_own_meta_tags(tmp_path, mock_upstream):
    (tmp_path / "index.html").write_text(
        '<html><head><title>Remote Radar</title><meta name="description" content="generic" />'
        '<meta property="og:title" content="generic" /></head>'
        '<body><div id="root"></div></body></html>'
    )
    mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(opencage_result(name="Santa <Fe>")))
    )
    with TestClient(create_app(make_settings(frontend_dist=tmp_path))) as client:
        page = client.get("/city/santa-fe--nm--us")
        home = client.get("/")
        sitemap = client.get("/sitemap.xml")

    assert "<title>Santa &lt;Fe&gt;, New Mexico, United States of America: remote work guide" in page.text
    assert 'content="generic"' not in page.text
    assert '<link rel="canonical" href="https://remoteradar.net/city/santa-fe--nm--us" />' in page.text
    assert page.text.count('property="og:title"') == 1
    assert "<h1>Santa &lt;Fe&gt;, New Mexico" in page.text
    assert page.headers["content-security-policy"] == CONTENT_SECURITY_POLICY
    assert "<title>Remote Radar</title>" in home.text
    assert sitemap.headers["content-type"].startswith("application/xml")
    assert "<loc>https://remoteradar.net/city/lisbon--pt</loc>" in sitemap.text


def test_city_page_falls_back_to_generic_html_when_city_is_unknown(tmp_path, mock_upstream):
    (tmp_path / "index.html").write_text(
        '<html><head><title>Remote Radar</title></head><div id="root"></div>'
    )
    mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    with TestClient(create_app(make_settings(frontend_dist=tmp_path))) as client:
        page = client.get("/city/nowhere--xx")
    assert page.status_code == 200
    assert "<title>Remote Radar</title>" in page.text
