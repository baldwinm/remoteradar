"""The remote work score: factor scoring, reweighting when data is missing, and the endpoint."""

import httpx

from app.models import Advisory, City, Internet, OpeningPeriod, Place, PlacesResponse, Speed, StaysResponse
from app.services import score
from app.services.climate import ARCHIVE_URL
from app.services.essentials import ADVISORIES_URL
from app.services.places import SEARCH_NEARBY_URL, SEARCH_TEXT_URL
from app.services.stays import AUTOCOMPLETE_URL, PROPERTIES_URL

from .test_work_features import LISBON_ID, climate_payload, geocoder  # noqa: F401 (autouse fixture)

CITY = City(id="lisbon--pt", name="Lisbon", country="Portugal", country_code="pt", lat=38.72, lng=-9.14)


def place(type_, rating=4.6, lat=38.72, lng=-9.14, hours=None, n=0):
    return Place(
        id=f"{type_}-{n}",
        name=f"{type_} {n}",
        type=type_,
        address="",
        rating=rating,
        user_ratings_total=100,
        price_level=None,
        lat=lat,
        lng=lng,
        website=None,
        phone=None,
        maps_url="https://maps.google.com",
        opening_hours=hours,
    )


def test_internet_full_marks_and_mobile_fallback():
    fast = Speed(download_mbps=200, upload_mbps=80, latency_ms=10, tests=500)
    full, detail = score.internet_factor(Internet(fixed=fast, mobile=fast, period="2026 Q2"))
    assert full == 100
    assert detail.startswith("200 Mbps down, 80 up, 10 ms latency at home")

    slow_mobile = Speed(download_mbps=25, upload_mbps=10, latency_ms=60, tests=100)
    value, detail = score.internet_factor(Internet(fixed=None, mobile=slow_mobile, period=""))
    # 48*0.25 + 24*0.2 + 16*0.5 + 12*0.5
    assert round(value, 1) == 30.8
    assert "on mobile" in detail
    assert score.internet_factor(None) is None


def test_places_counts_nearby_coworking_and_long_cafe_hours():
    early = [OpeningPeriod(open_day=1, open_minute=7 * 60, close_day=1, close_minute=15 * 60)]
    short = [OpeningPeriod(open_day=1, open_minute=9 * 60, close_day=1, close_minute=17 * 60)]
    data = PlacesResponse(
        places=[place("coworking", n=i) for i in range(10)]
        # Far outside the city: ignored.
        + [place("coworking", lat=40.0, lng=-8.0, n=99)]
        + [place("coffee", hours=early, n=i) for i in range(3)]
        + [place("coffee", hours=short, n=i + 10) for i in range(17)],
        counts={"coworking": 11, "coffee": 20, "total": 31},
    )
    value, detail = score.places_factor(CITY, data)
    assert value == 100
    assert detail == "10 coworking spaces (avg 4.6★), 20 cafés, 3 open early or late"
    assert score.places_factor(CITY, None) is None


def test_cost_slides_from_cheap_to_dear():
    def stays_at(price):
        return StaysResponse(
            checkin="", checkout="", occupants=1, average_price=price, currency="USD", stays=[]
        )

    assert score.cost_factor(stays_at(50))[0] == 100
    assert score.cost_factor(stays_at(250))[0] == 0
    assert round(score.cost_factor(stays_at(155))[0]) == 50
    assert score.cost_factor(stays_at(None)) is None


def test_safety_levels_and_us_cities():
    advisory = Advisory(
        level=2, title="Mexico - Level 2: Exercise Increased Caution", url="https://x", updated=None
    )
    assert score.safety_factor(CITY, advisory) == (
        75,
        "US State Dept advisory: Level 2, exercise increased caution",
    )
    assert score.safety_factor(CITY, None) is None
    us = CITY.model_copy(update={"country_code": "us"})
    assert score.safety_factor(us, None)[0] == 100


def test_missing_factors_drop_out_and_the_rest_reweight():
    result = score.combine(
        {"internet": None, "places": (80, "a"), "cost": (50, "b"), "safety": (100, "c"), "climate": None}
    )
    # (25*80 + 20*50 + 15*100) / 60
    assert result.score == 75
    assert (result.tier, result.label, result.counted) == ("good", "Good", 3)
    weights = {f.key: f.weight for f in result.factors}
    assert weights == {"internet": 0, "places": 42, "cost": 33, "safety": 25, "climate": 0}

    too_few = score.combine(
        {"internet": (90, "a"), "places": (90, "b"), "cost": None, "safety": None, "climate": None}
    )
    assert too_few.score is None and too_few.tier == "none"


def test_tiers():
    assert [score.tier_for(n)[1] for n in (95, 80, 79, 65, 64, 50, 49)] == [
        "Excellent",
        "Excellent",
        "Good",
        "Good",
        "Fair",
        "Fair",
        "Challenging",
    ]


def test_score_endpoint_uses_every_source(client, mock_upstream):
    mock_upstream.post(SEARCH_NEARBY_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "places": [
                    {
                        "id": f"c{i}",
                        "displayName": {"text": f"Cafe {i}"},
                        "rating": 4.5,
                        "userRatingCount": 10,
                    }
                    for i in range(5)
                ]
            },
        )
    )
    mock_upstream.post(SEARCH_TEXT_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "places": [{"id": "w1", "displayName": {"text": "Hub"}, "rating": 4.8, "userRatingCount": 9}]
            },
        )
    )
    mock_upstream.get(AUTOCOMPLETE_URL).mock(return_value=httpx.Response(200, json=[{"dest_id": "1"}]))
    mock_upstream.get(PROPERTIES_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "result": [
                    {
                        "type": "property_card",
                        "hotel_id": 1,
                        "hotel_name": "Hotel",
                        "composite_price_breakdown": {
                            "gross_amount_per_night": {"value": 100, "currency": "USD"}
                        },
                    }
                ]
            },
        )
    )
    mock_upstream.get(ADVISORIES_URL).mock(
        return_value=httpx.Response(200, json=[{"Title": "Portugal - Level 1: Exercise Normal Precautions"}])
    )
    mock_upstream.get(ARCHIVE_URL).mock(return_value=httpx.Response(200, json=climate_payload()))

    data = client.get(f"/api/cities/{LISBON_ID}/score").json()

    factors = {f["key"]: f for f in data["factors"]}
    assert factors["safety"]["score"] == 100
    assert factors["cost"]["detail"] == "Average hotel night $100, a week from now"
    assert factors["places"]["detail"].startswith("1 coworking space (avg 4.8★), 5 cafés")
    assert factors["climate"]["score"] is not None
    assert data["counted"] >= 4
    assert data["score"] is not None and data["label"]


def test_score_survives_failing_sources(client, mock_upstream):
    for route in (mock_upstream.post(SEARCH_NEARBY_URL), mock_upstream.post(SEARCH_TEXT_URL)):
        route.mock(return_value=httpx.Response(500))
    mock_upstream.get(AUTOCOMPLETE_URL).mock(return_value=httpx.Response(500))
    mock_upstream.get(ADVISORIES_URL).mock(return_value=httpx.Response(500))
    mock_upstream.get(ARCHIVE_URL).mock(return_value=httpx.Response(500))

    response = client.get(f"/api/cities/{LISBON_ID}/score")

    assert response.status_code == 200
    data = response.json()
    assert data["score"] is None
    assert data["tier"] == "none"
