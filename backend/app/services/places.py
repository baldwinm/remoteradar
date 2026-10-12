"""Coffee shops, coworking spaces and restaurants from Google Places API (New).

The three categories are requested at the same time, and each request already asks
for website, phone and Maps link through the field mask, so no follow-up Place
Details calls are needed (the old backend made up to 15 of those per city).
"""

import asyncio
import logging
from typing import Any

from ..context import AppContext
from ..errors import ServiceNotConfiguredError, UpstreamError
from ..http import request_json
from ..models import City, Place, PlaceCounts, PlacesResponse, PlaceType

logger = logging.getLogger(__name__)

SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_TTL = 12 * 3600

FIELD_MASK = ",".join(
    f"places.{field}"
    for field in (
        "id",
        "displayName",
        "formattedAddress",
        "shortFormattedAddress",
        "location",
        "rating",
        "userRatingCount",
        "priceLevel",
        "websiteUri",
        "nationalPhoneNumber",
        "googleMapsUri",
        "businessStatus",
    )
)

PRICE_LEVELS = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}

CATEGORY_ORDER: tuple[PlaceType, ...] = ("coffee", "coworking", "restaurant")


def _circle(city: City, radius_m: float) -> dict[str, Any]:
    return {"circle": {"center": {"latitude": city.lat, "longitude": city.lng}, "radius": radius_m}}


def _category_request(category: PlaceType, city: City) -> tuple[str, dict[str, Any]]:
    if category == "coffee":
        return SEARCH_NEARBY_URL, {
            "includedTypes": ["coffee_shop", "cafe"],
            "maxResultCount": 20,
            "rankPreference": "POPULARITY",
            "locationRestriction": _circle(city, 3000),
        }
    if category == "coworking":
        # Nearby search has no keyword filter, so coworking uses text search instead.
        return SEARCH_TEXT_URL, {
            "textQuery": "coworking space",
            "pageSize": 20,
            "locationBias": _circle(city, 5000),
        }
    return SEARCH_NEARBY_URL, {
        "includedTypes": ["restaurant"],
        "maxResultCount": 20,
        "rankPreference": "POPULARITY",
        "locationRestriction": _circle(city, 3000),
    }


async def get_places(ctx: AppContext, city: City) -> PlacesResponse:
    api_key = ctx.settings.google_api_key
    if not api_key:
        logger.error("GOOGLE_API_KEY is not set; places are unavailable")
        raise ServiceNotConfiguredError()

    async def load() -> dict[str, Any]:
        results = await asyncio.gather(
            *(_search_category(ctx, api_key, category, city) for category in CATEGORY_ORDER),
            return_exceptions=True,
        )
        failures = [r for r in results if isinstance(r, BaseException)]
        for failure in failures:
            if not isinstance(failure, UpstreamError):
                raise failure
            logger.warning("Places category failed: %s", failure)
        if len(failures) == len(results):
            raise failures[0]

        seen: set[str] = set()
        places: list[Place] = []
        for batch in results:
            if isinstance(batch, BaseException):
                continue
            for place in batch:
                if place.id not in seen:
                    seen.add(place.id)
                    places.append(place)

        places.sort(key=lambda p: (p.rating or 0, p.user_ratings_total), reverse=True)
        counts = PlaceCounts(
            coffee=sum(p.type == "coffee" for p in places),
            coworking=sum(p.type == "coworking" for p in places),
            restaurant=sum(p.type == "restaurant" for p in places),
            total=len(places),
        )
        return PlacesResponse(places=places, counts=counts, partial=bool(failures)).model_dump()

    data = await ctx.loader.get_or_load(f"places:{city.id}", PLACES_TTL, load)
    return PlacesResponse.model_validate(data)


async def _search_category(ctx: AppContext, api_key: str, category: PlaceType, city: City) -> list[Place]:
    url, body = _category_request(category, city)
    headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK}
    try:
        data = await request_json(ctx.http, "Google Places", "POST", url, json=body, headers=headers)
    except UpstreamError as exc:
        if exc.upstream_status == 403:
            logger.error(
                "Google rejected the Places request (HTTP 403). Make sure 'Places API (New)' "
                "is enabled for the project that owns GOOGLE_API_KEY and that the key's API "
                "restrictions allow it."
            )
        raise
    return [p for raw in data.get("places") or [] if (p := _parse_place(raw, category))]


def _parse_place(raw: dict[str, Any], category: PlaceType) -> Place | None:
    place_id = raw.get("id")
    name = (raw.get("displayName") or {}).get("text")
    if not place_id or not name or raw.get("businessStatus") == "CLOSED_PERMANENTLY":
        return None
    location = raw.get("location") or {}
    return Place(
        id=str(place_id),
        name=str(name),
        type=category,
        address=str(raw.get("shortFormattedAddress") or raw.get("formattedAddress") or ""),
        rating=raw.get("rating"),
        user_ratings_total=int(raw.get("userRatingCount") or 0),
        price_level=PRICE_LEVELS.get(raw.get("priceLevel", "")),
        lat=location.get("latitude"),
        lng=location.get("longitude"),
        website=safe_http_url(raw.get("websiteUri")),
        phone=raw.get("nationalPhoneNumber") or None,
        maps_url=safe_http_url(raw.get("googleMapsUri"))
        or f"https://www.google.com/maps/place/?q=place_id:{place_id}",
    )


def safe_http_url(value: Any) -> str | None:
    """Only pass through http(s) links, so a bad upstream value can't become a javascript: href."""
    if isinstance(value, str) and value.lower().startswith(("https://", "http://")):
        return value
    return None
