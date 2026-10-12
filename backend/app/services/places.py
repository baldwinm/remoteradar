"""Coffee shops, coworking spaces, restaurants, gyms, parks and laundromats from Google Places API (New).

The three core categories are requested together when a city page opens. Gyms, parks and
laundromats are only requested when someone asks for them, so they cost nothing for most
visits. Each request already asks for website, phone, Maps link and opening hours through
the field mask, so no follow-up Place Details calls are needed.
"""

import asyncio
import logging
from typing import Any

from ..context import AppContext
from ..errors import ServiceNotConfiguredError, UpstreamError
from ..http import request_json
from ..models import City, OpeningPeriod, Place, PlaceCounts, PlacesResponse, PlaceType

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
        # Same billing tier as rating, website and phone above, so it adds no cost.
        "regularOpeningHours.periods",
    )
)

PRICE_LEVELS = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}

CORE_CATEGORIES: tuple[PlaceType, ...] = ("coffee", "coworking", "restaurant")
# Fetched on demand, one category per request.
EXTRA_CATEGORIES: dict[PlaceType, tuple[list[str], float]] = {
    "gym": (["gym", "fitness_center"], 4000),
    "park": (["park"], 5000),
    "laundry": (["laundry"], 4000),
}


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
    included_types, radius = EXTRA_CATEGORIES.get(category, (["restaurant"], 3000))
    return SEARCH_NEARBY_URL, {
        "includedTypes": included_types,
        "maxResultCount": 20,
        "rankPreference": "POPULARITY",
        "locationRestriction": _circle(city, radius),
    }


async def get_places(ctx: AppContext, city: City, category: PlaceType | None = None) -> PlacesResponse:
    """The core categories together, or a single on-demand category such as gyms."""
    api_key = ctx.settings.google_api_key
    if not api_key:
        logger.error("GOOGLE_API_KEY is not set; places are unavailable")
        raise ServiceNotConfiguredError()

    async def load() -> dict[str, Any]:
        results = await asyncio.gather(
            *(_search_category(ctx, api_key, c, city) for c in categories),
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
        counts = PlaceCounts(total=len(places))
        for place in places:
            setattr(counts, place.type, getattr(counts, place.type) + 1)
        return PlacesResponse(places=places, counts=counts, partial=bool(failures)).model_dump()

    if category in EXTRA_CATEGORIES:
        categories: tuple[PlaceType, ...] = (category,)
        key = f"places:{city.id}:{category}"
    else:
        categories = CORE_CATEGORIES
        key = f"places:{city.id}"
    data = await ctx.loader.get_or_load(key, PLACES_TTL, load)
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
        opening_hours=_parse_periods((raw.get("regularOpeningHours") or {}).get("periods")),
    )


def _parse_periods(periods: Any) -> list[OpeningPeriod] | None:
    if not isinstance(periods, list) or not periods:
        return None
    parsed = []
    for period in periods:
        opens = period.get("open") if isinstance(period, dict) else None
        if not isinstance(opens, dict) or "day" not in opens:
            continue
        closes = period.get("close") if isinstance(period.get("close"), dict) else None
        parsed.append(
            OpeningPeriod(
                open_day=int(opens["day"]),
                open_minute=int(opens.get("hour", 0)) * 60 + int(opens.get("minute", 0)),
                close_day=int(closes["day"]) if closes and "day" in closes else None,
                close_minute=int(closes.get("hour", 0)) * 60 + int(closes.get("minute", 0))
                if closes
                else None,
            )
        )
    return parsed or None


def safe_http_url(value: Any) -> str | None:
    """Only pass through http(s) links, so a bad upstream value can't become a javascript: href."""
    if isinstance(value, str) and value.lower().startswith(("https://", "http://")):
        return value
    return None
