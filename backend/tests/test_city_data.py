import json

import httpx
import pytest

from app.services.geocoding import OPENCAGE_URL
from app.services.places import SEARCH_NEARBY_URL, SEARCH_TEXT_URL
from app.services.stays import AUTOCOMPLETE_URL, PROPERTIES_URL
from app.services.weather import OPEN_METEO_URL

from .conftest import opencage_response, opencage_result

CITY_ID = "santa-fe--nm--us"


@pytest.fixture(autouse=True)
def geocoder(mock_upstream):
    return mock_upstream.get(OPENCAGE_URL).mock(
        return_value=httpx.Response(200, json=opencage_response(opencage_result()))
    )


def google_place(place_id, name, rating=4.5, count=100, **extra):
    return {
        "id": place_id,
        "displayName": {"text": name},
        "shortFormattedAddress": f"{name} St",
        "location": {"latitude": 35.68, "longitude": -105.93},
        "rating": rating,
        "userRatingCount": count,
        "googleMapsUri": f"https://maps.google.com/?cid={place_id}",
        **extra,
    }


def mock_places(router, coffee=None, coworking=None, restaurant=None):
    def nearby(request):
        body = json.loads(request.content)
        kind = "coffee" if "cafe" in body["includedTypes"] else "restaurant"
        return {"coffee": coffee, "restaurant": restaurant}[kind]

    router.post(SEARCH_NEARBY_URL).mock(side_effect=nearby)
    router.post(SEARCH_TEXT_URL).mock(return_value=coworking)


def test_places_fetches_categories_and_maps_fields(client, mock_upstream):
    mock_places(
        mock_upstream,
        coffee=httpx.Response(
            200,
            json={
                "places": [
                    google_place(
                        "c1",
                        "Bean There",
                        rating=4.8,
                        websiteUri="https://bean.example",
                        nationalPhoneNumber="(505) 555-0100",
                    ),
                    google_place("closed", "Gone Cafe", businessStatus="CLOSED_PERMANENTLY"),
                ]
            },
        ),
        coworking=httpx.Response(200, json={"places": [google_place("w1", "Desk Hub", rating=4.9)]}),
        restaurant=httpx.Response(
            200,
            json={
                "places": [
                    google_place(
                        "r1",
                        "Green Chile",
                        rating=4.6,
                        priceLevel="PRICE_LEVEL_MODERATE",
                        websiteUri="javascript:alert(1)",
                    ),
                    google_place("c1", "Bean There"),  # duplicate of a coffee result
                ]
            },
        ),
    )

    response = client.get(f"/api/cities/{CITY_ID}/places")

    assert response.status_code == 200
    data = response.json()
    assert [p["id"] for p in data["places"]] == ["w1", "c1", "r1"]
    assert data["counts"] == {"coffee": 1, "coworking": 1, "restaurant": 1, "total": 3}
    assert data["partial"] is False
    coffee = data["places"][1]
    assert coffee["website"] == "https://bean.example"
    assert coffee["phone"] == "(505) 555-0100"
    restaurant = data["places"][2]
    assert restaurant["price_level"] == 2
    assert restaurant["website"] is None  # unsafe URL dropped

    requests = [call.request for call in mock_upstream.calls if "places.googleapis" in str(call.request.url)]
    assert len(requests) == 3
    for request in requests:
        assert request.headers["X-Goog-Api-Key"] == "test-google"
        assert "key=" not in str(request.url)
        assert "places.websiteUri" in request.headers["X-Goog-FieldMask"]


def test_places_filter_by_type(client, mock_upstream):
    ok = httpx.Response(200, json={"places": [google_place("x", "X")]})
    mock_places(
        mock_upstream,
        coffee=ok,
        coworking=httpx.Response(200, json={}),
        restaurant=httpx.Response(200, json={}),
    )
    data = client.get(f"/api/cities/{CITY_ID}/places", params={"type": "coworking"}).json()
    assert data["places"] == []
    assert client.get(f"/api/cities/{CITY_ID}/places", params={"type": "bars"}).status_code == 400


def test_places_survive_one_category_failing(client, mock_upstream):
    mock_places(
        mock_upstream,
        coffee=httpx.Response(200, json={"places": [google_place("c1", "Bean There")]}),
        coworking=httpx.Response(500, text="boom"),
        restaurant=httpx.Response(200, json={"places": []}),
    )
    data = client.get(f"/api/cities/{CITY_ID}/places").json()
    assert data["partial"] is True
    assert data["counts"]["coffee"] == 1


def test_places_all_failing_is_502(client, mock_upstream):
    denied = httpx.Response(403, json={"error": {"status": "PERMISSION_DENIED"}})
    mock_places(mock_upstream, coffee=denied, coworking=denied, restaurant=denied)
    assert client.get(f"/api/cities/{CITY_ID}/places").status_code == 502


def open_meteo_payload():
    hours = [f"2026-10-12T{h:02d}:00" for h in range(24)] + [f"2026-10-13T{h:02d}:00" for h in range(24)]
    return {
        "timezone": "America/Denver",
        "current": {
            "time": "2026-10-12T14:15",
            "temperature_2m": 68.4,
            "apparent_temperature": 66.0,
            "relative_humidity_2m": 0,
            "is_day": 1,
            "precipitation": 0.0,
            "weather_code": 2,
            "cloud_cover": 40,
            "wind_speed_10m": 8.1,
            "wind_direction_10m": 220,
        },
        "hourly": {
            "time": hours,
            "temperature_2m": list(range(48)),
            "precipitation_probability": [10] * 48,
            "weather_code": [1] * 48,
            "is_day": [1] * 48,
        },
        "daily": {
            "time": ["2026-10-12", "2026-10-13"],
            "weather_code": [2, 61],
            "temperature_2m_max": [70, 65],
            "temperature_2m_min": [45, 44],
            "precipitation_probability_max": [10, 80],
            "sunrise": ["2026-10-12T07:09", "2026-10-13T07:10"],
            "sunset": ["2026-10-12T18:30", "2026-10-13T18:29"],
        },
    }


def test_weather_starts_hourly_forecast_at_current_hour(client, mock_upstream):
    route = mock_upstream.get(OPEN_METEO_URL).mock(
        return_value=httpx.Response(200, json=open_meteo_payload())
    )

    response = client.get(f"/api/cities/{CITY_ID}/weather", params={"units": "imperial"})

    assert response.status_code == 200
    data = response.json()
    assert data["current"]["description"] == "Partly cloudy"
    assert data["current"]["relative_humidity"] == 0
    assert data["hourly"][0]["time"] == "2026-10-12T14:00"
    assert len(data["hourly"]) == 24
    assert data["daily"][1]["description"] == "Slight rain"
    params = route.calls.last.request.url.params
    assert params["temperature_unit"] == "fahrenheit"
    assert params["latitude"] == "35.69"


def test_weather_is_cached_per_units(client, mock_upstream):
    route = mock_upstream.get(OPEN_METEO_URL).mock(
        return_value=httpx.Response(200, json=open_meteo_payload())
    )
    client.get(f"/api/cities/{CITY_ID}/weather")
    client.get(f"/api/cities/{CITY_ID}/weather")
    client.get(f"/api/cities/{CITY_ID}/weather", params={"units": "imperial"})
    assert route.call_count == 2


def test_weather_rejects_bad_units(client):
    assert client.get(f"/api/cities/{CITY_ID}/weather", params={"units": "kelvin"}).status_code == 400


def booking_card(hotel_id, price, **extra):
    return {
        "type": "property_card",
        "hotel_id": hotel_id,
        "hotel_name_trans": f"Hotel {hotel_id}",
        "accommodation_type_name": "Hotel",
        "review_score": 8.6,
        "review_score_word": "Fabulous",
        "review_nr": 120,
        "class": 3,
        "composite_price_breakdown": {"gross_amount_per_night": {"value": price, "currency": "USD"}},
        "main_photo_url": "https://cf.bstatic.com/square60/photo.jpg",
        "countrycode": "us",
        **extra,
    }


def test_stays_look_up_destination_then_list_properties(client, mock_upstream):
    autocomplete = mock_upstream.get(AUTOCOMPLETE_URL).mock(
        return_value=httpx.Response(
            200, json=[{"dest_type": "region", "dest_id": "9"}, {"dest_type": "city", "dest_id": "20127"}]
        )
    )
    properties = mock_upstream.get(PROPERTIES_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "result": [
                    booking_card(1, 100.0),
                    booking_card(2, 150.555),
                    booking_card(3, 0),
                    {"type": "banner"},
                ]
            },
        )
    )

    response = client.get(f"/api/cities/{CITY_ID}/stays", params={"occupants": 2})

    assert response.status_code == 200
    data = response.json()
    assert data["average_price"] == 125.28
    assert [s["id"] for s in data["stays"]] == ["1", "2", "3"]
    assert data["stays"][0]["image_url"] == "https://cf.bstatic.com/max1280x900/photo.jpg"
    assert data["stays"][2]["price_per_night"] is None
    assert autocomplete.calls.last.request.url.params["text"] == "Santa Fe, New Mexico"
    sent = properties.calls.last.request
    assert sent.url.params["dest_ids"] == "20127"
    assert sent.url.params["guest_qty"] == "2"
    assert sent.headers["x-rapidapi-key"] == "test-rapidapi"

    client.get(f"/api/cities/{CITY_ID}/stays", params={"occupants": 3})
    assert autocomplete.call_count == 1  # destination ID is cached per city


def test_missing_api_key_is_503(mock_upstream):
    from fastapi.testclient import TestClient

    from app.main import create_app

    from .conftest import make_settings

    with TestClient(create_app(make_settings(rapidapi_key=""))) as client:
        response = client.get(f"/api/cities/{CITY_ID}/stays")
    assert response.status_code == 503
    assert response.json()["error"] == "service_unavailable"
