"""Typical weather by month, averaged from the last five full years of Open-Meteo history."""

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from ..context import AppContext
from ..errors import UpstreamError
from ..http import request_json
from ..models import City, Climate, ClimateMonth, Units

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
CLIMATE_TTL = 30 * 24 * 3600
YEARS = 5
RAINY_DAY_MM = 1.0
BEST_MONTHS = 3
# The most comfortable average high for working and getting around, in °C.
IDEAL_HIGH_C = 24.0


async def get_climate(ctx: AppContext, city: City, units: Units) -> Climate:
    # Climate barely changes over a few km, so round more coarsely than the forecast does.
    lat, lng = round(city.lat, 1), round(city.lng, 1)
    last_year = datetime.now(UTC).year - 1
    first_year = last_year - YEARS + 1

    async def load() -> dict[str, Any]:
        params = {
            "latitude": lat,
            "longitude": lng,
            "start_date": f"{first_year}-01-01",
            "end_date": f"{last_year}-12-31",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration",
            "timezone": "auto",
        }
        raw = await request_json(ctx.http, "Open-Meteo", "GET", ARCHIVE_URL, params=params)
        return {"years": f"{first_year}-{last_year}", "months": monthly_averages(raw)}

    # Stored in metric and converted per request, so both unit systems share one upstream call.
    data = await ctx.loader.get_or_load(f"climate:{lat}:{lng}:{last_year}", CLIMATE_TTL, load)
    months = [ClimateMonth.model_validate(m) for m in data["months"]]
    if units == "imperial":
        months = [_to_imperial(m) for m in months]
    return Climate(units=units, years=data["years"], months=months)


def monthly_averages(raw: dict[str, Any]) -> list[dict[str, Any]]:
    daily = raw.get("daily") or {}
    times: list[str] = daily.get("time") or []
    if not times:
        raise UpstreamError("Open-Meteo", "climate response had no daily data")

    highs: dict[int, list[float]] = defaultdict(list)
    lows: dict[int, list[float]] = defaultdict(list)
    sunshine: dict[int, list[float]] = defaultdict(list)
    # Rain totals and rainy-day counts are per month-of-a-year, then averaged across years.
    rain: dict[tuple[int, int], float] = defaultdict(float)
    rainy: dict[tuple[int, int], int] = defaultdict(int)
    rain_seen: set[tuple[int, int]] = set()

    def series(key: str) -> list[Any]:
        return daily.get(key) or [None] * len(times)

    for day, high, low, precip, sun in zip(
        times,
        series("temperature_2m_max"),
        series("temperature_2m_min"),
        series("precipitation_sum"),
        series("sunshine_duration"),
        strict=False,
    ):
        year, month = int(day[:4]), int(day[5:7])
        if high is not None:
            highs[month].append(high)
        if low is not None:
            lows[month].append(low)
        if sun is not None:
            sunshine[month].append(sun / 3600)
        if precip is not None:
            rain_seen.add((year, month))
            rain[(year, month)] += precip
            rainy[(year, month)] += precip >= RAINY_DAY_MM

    months = []
    for month in range(1, 13):
        year_months = [key for key in rain_seen if key[1] == month]
        months.append(
            {
                "month": month,
                "temperature_max": _mean(highs[month]),
                "temperature_min": _mean(lows[month]),
                "precipitation": _mean([rain[k] for k in year_months]),
                "rainy_days": _mean([rainy[k] for k in year_months]),
                "sunshine_hours": _mean(sunshine[month]),
                "best": False,
            }
        )

    scored = [m for m in months if m["temperature_max"] is not None]
    scored.sort(key=_comfort, reverse=True)
    for month in scored[:BEST_MONTHS]:
        month["best"] = True
    return months


def _comfort(month: dict[str, Any]) -> float:
    """Higher is better: close to a mild high, and few rainy days."""
    return -abs(month["temperature_max"] - IDEAL_HIGH_C) - 0.6 * (month["rainy_days"] or 0)


def _mean(values: list[float] | list[int]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def _c_to_f(value: float | None) -> float | None:
    return None if value is None else round(value * 9 / 5 + 32, 1)


def _to_imperial(month: ClimateMonth) -> ClimateMonth:
    return month.model_copy(
        update={
            "temperature_max": _c_to_f(month.temperature_max),
            "temperature_min": _c_to_f(month.temperature_min),
            "precipitation": None if month.precipitation is None else round(month.precipitation / 25.4, 1),
        }
    )
