"""City search and city-ID resolution through the OpenCage geocoder."""

import logging
import re
from typing import Any

from ..city_ids import make_city_id, parse_city_id
from ..context import AppContext
from ..errors import NotFoundError, ServiceNotConfiguredError, UpstreamError
from ..http import request_json
from ..models import City

logger = logging.getLogger(__name__)

OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json"
SEARCH_TTL = 7 * 24 * 3600
CITY_TTL = 30 * 24 * 3600

# Components that can name the place, most specific first.
_NAME_COMPONENTS = (
    "city",
    "town",
    "village",
    "municipality",
    "county",
    "state_district",
    "state",
    "region",
    "island",
)
_MAJOR_US_CITIES = frozenset(
    {
        "new york",
        "los angeles",
        "chicago",
        "houston",
        "phoenix",
        "philadelphia",
        "san antonio",
        "san diego",
        "dallas",
    }
)
_ENGLISH_SPEAKING = frozenset({"gb", "ca", "au", "nz"})
_STATE_CODE = re.compile(r"^[A-Za-z0-9]{1,4}$")


def normalize_query(query: str) -> str:
    return " ".join(query.split())[:100]


async def search_cities(ctx: AppContext, query: str) -> list[City]:
    query = normalize_query(query)
    if len(query) < 2:
        return []

    async def load() -> list[dict[str, Any]]:
        results = await _geocode(ctx, query)
        cities = _dedupe(_parse_result(r) for r in results)
        cities.sort(key=_search_rank, reverse=True)
        cities = cities[:5]
        # Prime the ID cache so opening a result never needs another geocoder call.
        for city in cities:
            await ctx.cache.set(f"city:{city.id}", city.model_dump(), CITY_TTL)
        return [city.model_dump() for city in cities]

    data = await ctx.loader.get_or_load(f"search:{query.casefold()}", SEARCH_TTL, load)
    return [City.model_validate(item) for item in data]


async def resolve_city(ctx: AppContext, city_id: str) -> City:
    """Turn a city ID back into a full city (name, country, coordinates)."""

    async def load() -> dict[str, Any]:
        ref = parse_city_id(city_id)
        if not ref.name:
            raise NotFoundError("City not found.")
        results = await _geocode(ctx, ref.search_text, country_code=ref.country_code)
        candidates = _dedupe(_parse_result(r) for r in results)
        if not candidates:
            raise NotFoundError("City not found.")
        match = next((c for c in candidates if c.id == city_id), candidates[0])
        return match.model_dump()

    data = await ctx.loader.get_or_load(f"city:{city_id}", CITY_TTL, load)
    return City.model_validate(data)


async def _geocode(ctx: AppContext, query: str, country_code: str = "") -> list[dict[str, Any]]:
    api_key = ctx.settings.opencage_api_key
    if not api_key:
        logger.error("OPENCAGE_API_KEY is not set; city search is unavailable")
        raise ServiceNotConfiguredError()

    params = {
        "q": query,
        "key": api_key,
        "limit": 8,
        "language": "en",
        "no_annotations": 1,
        "no_record": 1,
    }
    if country_code:
        params["countrycode"] = country_code

    data = await request_json(ctx.http, "OpenCage", "GET", OPENCAGE_URL, params=params)
    status = (data.get("status") or {}).get("code", 200)
    if status != 200:
        raise UpstreamError("OpenCage", (data.get("status") or {}).get("message", "error"), status)
    return data.get("results") or []


def _parse_result(result: dict[str, Any]) -> City | None:
    components = result.get("components") or {}
    geometry = result.get("geometry") or {}
    name = next((components[key] for key in _NAME_COMPONENTS if components.get(key)), None)
    lat, lng = geometry.get("lat"), geometry.get("lng")
    if not name or lat is None or lng is None:
        return None

    country_code = str(components.get("country_code") or "").lower()
    state = str(components.get("state") or "")
    state_code = str(components.get("state_code") or "")
    if not _STATE_CODE.match(state_code):
        state_code = ""
    # Don't repeat the name as its own region (e.g. a result that *is* a state).
    region = state_code or state
    if region.casefold() == str(name).casefold():
        region = ""

    return City(
        id=make_city_id(str(name), region, country_code or "xx"),
        name=str(name),
        state=state,
        state_code=state_code.upper(),
        country=str(components.get("country") or ""),
        country_code=country_code,
        lat=float(lat),
        lng=float(lng),
        formatted=str(result.get("formatted") or ""),
    )


def _dedupe(cities: Any) -> list[City]:
    seen: set[str] = set()
    unique: list[City] = []
    for city in cities:
        if city is not None and city.id not in seen:
            seen.add(city.id)
            unique.append(city)
    return unique


def _search_rank(city: City) -> int:
    """Ordering preference carried over from the original app: US cities first
    (Santa Fe, NM and big US cities above the rest), then other English-speaking
    countries, then everything else in the geocoder's own order."""
    name = city.name.casefold()
    score = 0
    if city.country_code == "us":
        score += 1000
        if name == "santa fe" and "new mexico" in city.state.casefold():
            score += 5000
        if name in _MAJOR_US_CITIES:
            score += 500
    if city.country_code in _ENGLISH_SPEAKING:
        score += 750
    return score
