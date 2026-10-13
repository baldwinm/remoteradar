import httpx

from app.services.geocoding import OPENCAGE_URL

from .conftest import opencage_response, opencage_result

SANTA_FE_NM = opencage_result()
SANTA_FE_AR = opencage_result(
    state="Santa Fe Province",
    state_code="S",
    country="Argentina",
    country_code="ar",
    lat=-31.63,
    lng=-60.7,
)


def test_search_returns_cities_with_new_ids(client, mock_upstream):
    route = mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(SANTA_FE_AR, SANTA_FE_NM))
    )

    response = client.get("/api/cities", params={"q": "Santa Fe"})

    assert response.status_code == 200
    cities = response.json()["cities"]
    # US results rank first, as in the original app.
    assert [c["id"] for c in cities] == ["santa-fe--nm--us", "santa-fe--s--ar"]
    assert cities[0]["lat"] == 35.687
    assert response.headers["cache-control"] == "public, max-age=3600"
    sent = route.calls.last.request.url.params
    assert sent["q"] == "Santa Fe"
    assert "no_annotations" not in sent
    assert cities[0]["timezone"] == "America/Denver"
    assert cities[0]["currency_code"] == "USD"
    assert cities[0]["currency_symbol"] == "$"


def test_search_results_are_cached_and_prime_city_lookup(client, mock_upstream):
    route = mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(SANTA_FE_NM))
    )

    client.get("/api/cities", params={"q": "santa fe"})
    client.get("/api/cities", params={"q": "  Santa   FE "})
    city = client.get("/api/cities/santa-fe--nm--us")

    assert route.call_count == 1
    assert city.status_code == 200
    assert city.json()["name"] == "Santa Fe"


def test_short_query_returns_empty_without_calling_geocoder(client, mock_upstream):
    route = mock_upstream.get(OPENCAGE_URL)
    response = client.get("/api/cities", params={"q": "a"})
    assert response.json() == {"cities": []}
    assert not route.called


def test_resolve_legacy_id_restricts_country(client, mock_upstream):
    route = mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(
            200,
            json=opencage_response(
                opencage_result(
                    name="Rio de Janeiro",
                    state="Rio de Janeiro",
                    state_code="RJ",
                    country="Brazil",
                    country_code="br",
                    lat=-22.9,
                    lng=-43.2,
                )
            ),
        )
    )

    response = client.get("/api/cities/rio_de_janeiro_br")

    assert response.status_code == 200
    assert response.json()["id"] == "rio-de-janeiro--rj--br"
    params = route.calls.last.request.url.params
    assert params["q"] == "rio de janeiro"
    assert params["countrycode"] == "br"


def test_unknown_city_is_404(client, mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(return_value=httpx.Response(200, json=opencage_response()))
    response = client.get("/api/cities/nowhere--zz")
    assert response.status_code == 404
    assert response.json()["error"] == "not_found"


def test_geocoder_failure_is_502_without_leaking_details(client, mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(
            401, json={"status": {"code": 401, "message": "invalid key test-opencage"}}
        )
    )
    response = client.get("/api/cities", params={"q": "Paris"})
    assert response.status_code == 502
    assert response.json()["error"] == "upstream_unavailable"
    assert "test-opencage" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_geocoder_timeout_is_502(client, mock_upstream):
    mock_upstream.get(OPENCAGE_URL).mock(side_effect=httpx.ReadTimeout("slow"))
    response = client.get("/api/cities", params={"q": "Paris"})
    assert response.status_code == 502


def test_invalid_city_id_is_rejected(client):
    assert client.get("/api/cities/<script>").status_code in (400, 404)
    assert client.get("/api/cities/" + "a" * 200).status_code == 400


def test_city_carries_geocoder_bounds():
    from app.services.geocoding import _parse_result

    result = opencage_result()
    result["bounds"] = {
        "northeast": {"lat": 35.75, "lng": -105.88},
        "southwest": {"lat": 35.6, "lng": -106.1},
    }
    city = _parse_result(result)
    assert city.bounds.model_dump() == {"south": 35.6, "west": -106.1, "north": 35.75, "east": -105.88}
    assert _parse_result(opencage_result()).bounds is None
