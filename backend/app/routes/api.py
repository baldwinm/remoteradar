"""Public JSON API under /api."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response

from ..city_ids import CITY_ID_PATTERN, MAX_ID_LENGTH
from ..context import AppContext, get_context
from ..models import (
    City,
    CitySearchResponse,
    ErrorResponse,
    PlacesResponse,
    PlaceType,
    StaysResponse,
    Units,
    Weather,
)
from ..ratelimit import rate_limit
from ..services import geocoding, places, stays, weather

router = APIRouter(
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    }
)

Ctx = Annotated[AppContext, Depends(get_context)]
CityId = Annotated[str, Path(max_length=MAX_ID_LENGTH, pattern=CITY_ID_PATTERN)]


def cache_for(response: Response, seconds: int) -> None:
    response.headers["Cache-Control"] = f"public, max-age={seconds}"


@router.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/cities",
    response_model=CitySearchResponse,
    dependencies=[Depends(rate_limit("search", 60, 60))],
)
async def search_cities(
    ctx: Ctx, response: Response, q: Annotated[str, Query(max_length=100)] = ""
) -> CitySearchResponse:
    """Search cities by name (used by the search box as you type)."""
    cities = await geocoding.search_cities(ctx, q)
    cache_for(response, 3600)
    return CitySearchResponse(cities=cities)


@router.get(
    "/cities/{city_id}",
    response_model=City,
    dependencies=[Depends(rate_limit("city", 60, 60))],
)
async def get_city(ctx: Ctx, response: Response, city_id: CityId) -> City:
    city = await geocoding.resolve_city(ctx, city_id)
    cache_for(response, 86400)
    return city


@router.get(
    "/cities/{city_id}/weather",
    response_model=Weather,
    dependencies=[Depends(rate_limit("weather", 30, 60))],
)
async def get_weather(ctx: Ctx, response: Response, city_id: CityId, units: Units = "metric") -> Weather:
    city = await geocoding.resolve_city(ctx, city_id)
    result = await weather.get_weather(ctx, city, units)
    cache_for(response, 900)
    return result


@router.get(
    "/cities/{city_id}/places",
    response_model=PlacesResponse,
    dependencies=[Depends(rate_limit("places", 20, 60))],
)
async def get_places(
    ctx: Ctx, response: Response, city_id: CityId, type: PlaceType | None = None
) -> PlacesResponse:
    city = await geocoding.resolve_city(ctx, city_id)
    result = await places.get_places(ctx, city)
    if type:
        result.places = [p for p in result.places if p.type == type]
    cache_for(response, 3600)
    return result


@router.get(
    "/cities/{city_id}/stays",
    response_model=StaysResponse,
    dependencies=[Depends(rate_limit("stays", 20, 60))],
)
async def get_stays(
    ctx: Ctx,
    response: Response,
    city_id: CityId,
    occupants: Annotated[int, Query(ge=1, le=8)] = 1,
) -> StaysResponse:
    city = await geocoding.resolve_city(ctx, city_id)
    result = await stays.get_stays(ctx, city, occupants)
    cache_for(response, 1800)
    return result
