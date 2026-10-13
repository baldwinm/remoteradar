"""Public JSON API under /api."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status

from ..city_ids import CITY_ID_PATTERN, MAX_ID_LENGTH
from ..context import AppContext, get_context
from ..models import (
    City,
    CitySearchResponse,
    CityView,
    Climate,
    ErrorResponse,
    Essentials,
    PlacesResponse,
    PlaceType,
    PopularCities,
    StaysResponse,
    Units,
    Weather,
    WorkScore,
)
from ..ratelimit import rate_limit
from ..services import climate, essentials, geocoding, places, popular, score, stays, weather

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
    """The core categories (coffee, coworking, restaurants) by default. `type` narrows them, and
    gym, park or laundry fetches that category on its own."""
    city = await geocoding.resolve_city(ctx, city_id)
    result = await places.get_places(ctx, city, type)
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
    checkin: date | None = None,
    nights: Annotated[int, Query(ge=1, le=stays.MAX_NIGHTS)] = 1,
) -> StaysResponse:
    city = await geocoding.resolve_city(ctx, city_id)
    result = await stays.get_stays(ctx, city, occupants, checkin, nights)
    cache_for(response, 1800)
    return result


@router.get(
    "/cities/{city_id}/essentials",
    response_model=Essentials,
    dependencies=[Depends(rate_limit("essentials", 30, 60))],
)
async def get_essentials(ctx: Ctx, response: Response, city_id: CityId) -> Essentials:
    """Time zone, currency and exchange rate, upcoming public holidays, internet speed."""
    city = await geocoding.resolve_city(ctx, city_id)
    result = await essentials.get_essentials(ctx, city)
    cache_for(response, 3600)
    return result


@router.get(
    "/cities/{city_id}/climate",
    response_model=Climate,
    dependencies=[Depends(rate_limit("climate", 30, 60))],
)
async def get_climate(ctx: Ctx, response: Response, city_id: CityId, units: Units = "metric") -> Climate:
    """Average weather for each month of the year, with the best months to visit marked."""
    city = await geocoding.resolve_city(ctx, city_id)
    result = await climate.get_climate(ctx, city, units)
    cache_for(response, 86400)
    return result


@router.get(
    "/cities/{city_id}/score",
    response_model=WorkScore,
    dependencies=[Depends(rate_limit("score", 30, 60))],
)
async def get_score(ctx: Ctx, response: Response, city_id: CityId) -> WorkScore:
    """The remote work score (0-100) with its four factors: internet, places to work, cost and
    climate. Factors without data are left out and the rest reweighted."""
    city = await geocoding.resolve_city(ctx, city_id)
    result = await score.get_score(ctx, city)
    cache_for(response, 3600)
    return result


@router.get(
    "/popular",
    response_model=PopularCities,
    dependencies=[Depends(rate_limit("popular", 30, 60))],
)
async def get_popular(
    ctx: Ctx, response: Response, tz: Annotated[str, Query(max_length=64)] = ""
) -> PopularCities:
    """The cities opened most in the last 30 days by people in the visitor's country (from the
    browser time zone `tz`), or across the whole site when that country has too little data."""
    country = popular.country_for_timezone(tz) or "none"

    async def load() -> dict:
        return (await popular.popular_cities(ctx.popular, tz)).model_dump()

    data = await ctx.loader.get_or_load(f"popular:{country}", popular.RESULT_TTL, load)
    cache_for(response, popular.RESULT_TTL)
    return PopularCities.model_validate(data)


@router.post(
    "/views",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit("views", 10, 60))],
)
async def record_view(ctx: Ctx, view: CityView) -> None:
    """Count one city page view toward the popular-city lists. Stores only daily totals."""
    city = await geocoding.resolve_city(ctx, view.city_id)
    await popular.record_view(ctx.popular, city.id, city.name, view.time_zone)
