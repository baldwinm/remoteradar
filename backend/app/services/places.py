"""Coffee shops, coworking spaces, restaurants, gyms, parks and laundromats from Google Places API (New).

The three core categories are requested together when a city page opens. Gyms, parks and
laundromats are only requested when someone asks for them, so they cost nothing for most
visits. Each request already asks for website, phone, Maps link and opening hours through
the field mask, so no follow-up Place Details calls are needed.

Results are kept inside the searched city: every search is restricted to an area around
the city (never just biased toward it), and then any place whose address names a different
town is dropped. A small town can show fewer places because of this; that's intended, so
a search for one city doesn't fill up with its neighbours.
"""

import asyncio
import logging
import math
import re
import unicodedata
from collections.abc import Iterable
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
        # Same tier again; used to drop places that are in a different town.
        "addressComponents",
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


# Text search can only be restricted to a rectangle: the city's own bounding box, trimmed
# to this far from the centre so a sprawling municipality doesn't reach into the countryside.
TEXT_SEARCH_HALF_SIZE_M = 5000
METERS_PER_DEGREE_LAT = 111_320

# Address components that name the town a place is in.
_TOWN_TYPES = frozenset({"locality", "postal_town"})
# Further components that may carry the city's name when the town above differs from what
# the geocoder calls the city (e.g. a district inside it).
_CITY_NAME_TYPES = _TOWN_TYPES | {
    "administrative_area_level_3",
    "sublocality",
    "sublocality_level_1",
}
_NAME_ABBREVIATIONS = {"saint": "st", "sainte": "ste", "mount": "mt", "fort": "ft"}


def _circle(city: City, radius_m: float) -> dict[str, Any]:
    return {"circle": {"center": {"latitude": city.lat, "longitude": city.lng}, "radius": radius_m}}


def _rectangle(city: City) -> dict[str, Any]:
    dlat = TEXT_SEARCH_HALF_SIZE_M / METERS_PER_DEGREE_LAT
    dlng = dlat / max(math.cos(math.radians(city.lat)), 0.01)
    south, west, north, east = city.lat - dlat, city.lng - dlng, city.lat + dlat, city.lng + dlng
    if b := city.bounds:
        clipped = (max(south, b.south), max(west, b.west), min(north, b.north), min(east, b.east))
        if clipped[0] < clipped[2] and clipped[1] < clipped[3]:
            south, west, north, east = clipped
    return {
        "rectangle": {
            "low": {"latitude": south, "longitude": west},
            "high": {"latitude": north, "longitude": east},
        }
    }


def _category_request(category: PlaceType, city: City) -> tuple[str, dict[str, Any]]:
    if category == "coffee":
        return SEARCH_NEARBY_URL, {
            "includedTypes": ["coffee_shop", "cafe"],
            "maxResultCount": 20,
            "rankPreference": "POPULARITY",
            "languageCode": "en",
            "locationRestriction": _circle(city, 3000),
        }
    if category == "coworking":
        # Nearby search has no keyword filter, so coworking uses text search instead.
        return SEARCH_TEXT_URL, {
            "textQuery": "coworking space",
            "pageSize": 20,
            "languageCode": "en",
            "locationRestriction": _rectangle(city),
        }
    included_types, radius = EXTRA_CATEGORIES.get(category, (["restaurant"], 3000))
    return SEARCH_NEARBY_URL, {
        "includedTypes": included_types,
        "maxResultCount": 20,
        "rankPreference": "POPULARITY",
        "languageCode": "en",
        "locationRestriction": _circle(city, radius),
    }


def _normalize_name(name: str) -> str:
    """ "Saint-Étienne" and "St Etienne" both become "stetienne"."""
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().casefold()
    words = re.findall(r"[a-z0-9]+", text)
    if words[:2] == ["city", "of"]:
        words = words[2:]
    return "".join(_NAME_ABBREVIATIONS.get(word, word) for word in words)


def _in_city(raw: dict[str, Any], city_name: str) -> bool | None:
    """Whether a place's address puts it in the city; None when the address names no town."""
    components = [c for c in raw.get("addressComponents") or [] if isinstance(c, dict)]
    if not any(_TOWN_TYPES & set(c.get("types") or ()) for c in components):
        return None
    names = {
        _normalize_name(str(c.get(key) or ""))
        for c in components
        if _CITY_NAME_TYPES & set(c.get("types") or ())
        for key in ("longText", "shortText")
    }
    return city_name in names


def _keep_in_city(batches: Iterable[list[dict[str, Any]]], city: City) -> list[list[dict[str, Any]]]:
    """Drop places whose address names a different town than the searched city.

    If not a single place names the city, the geocoder and Google probably just spell it
    differently ("Mexico City" vs "Ciudad de México"), so nothing is dropped and the search
    area restriction alone keeps results local.
    """
    batches = list(batches)
    city_name = _normalize_name(city.name)
    verdicts = [[_in_city(raw, city_name) for raw in batch] for batch in batches]
    if not any(v for batch in verdicts for v in batch):
        return batches
    return [
        [raw for raw, verdict in zip(batch, batch_verdicts, strict=True) if verdict is not False]
        for batch, batch_verdicts in zip(batches, verdicts, strict=True)
    ]


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

        loaded = [
            (c, r) for c, r in zip(categories, results, strict=True) if not isinstance(r, BaseException)
        ]
        kept = _keep_in_city((raw for _, raw in loaded), city)

        seen: set[str] = set()
        places: list[Place] = []
        for (batch_category, _), batch in zip(loaded, kept, strict=True):
            for raw in batch:
                place = _parse_place(raw, batch_category)
                if place and place.id not in seen:
                    seen.add(place.id)
                    places.append(place)

        places.sort(key=lambda p: (p.rating or 0, p.user_ratings_total), reverse=True)
        counts = PlaceCounts(total=len(places))
        for place in places:
            setattr(counts, place.type, getattr(counts, place.type) + 1)
        return PlacesResponse(places=places, counts=counts, partial=bool(failures)).model_dump()

    if category in EXTRA_CATEGORIES:
        categories: tuple[PlaceType, ...] = (category,)
        key = f"places:v2:{city.id}:{category}"
    else:
        categories = CORE_CATEGORIES
        key = f"places:v2:{city.id}"
    data = await ctx.loader.get_or_load(key, PLACES_TTL, load)
    return PlacesResponse.model_validate(data)


async def _search_category(
    ctx: AppContext, api_key: str, category: PlaceType, city: City
) -> list[dict[str, Any]]:
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
    return [raw for raw in data.get("places") or [] if isinstance(raw, dict)]


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
