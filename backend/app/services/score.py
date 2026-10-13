"""The remote work score: one 0-100 number per city, built from data the site already loads.

Five factors, each scored 0-100 on a smooth scale and weighted:
internet 25, places to work 25, cost 20, safety 15, climate 15.

A factor with no data (or whose source failed) drops out and the others scale up to fill its
share, so the score keeps working without any one source. With fewer than MIN_FACTORS
factors there is no score at all. Time-zone overlap is deliberately left out: it depends on
the visitor, not the city.

Every input comes from a call the city and compare pages already make, under the same cache
keys, so a score adds no new paid API calls.
"""

import asyncio
import calendar
import logging
import math
from collections.abc import Awaitable, Callable
from typing import Any

from ..context import AppContext
from ..errors import AppError
from ..models import (
    Advisory,
    City,
    Climate,
    Internet,
    Place,
    PlacesResponse,
    ScoreFactor,
    StaysResponse,
    WorkScore,
)
from . import climate as climate_service
from . import essentials, places, stays
from .internet import get_internet

logger = logging.getLogger(__name__)

SCORE_TTL = 3600
MIN_FACTORS = 3

WEIGHTS = {"internet": 25, "places": 25, "cost": 20, "safety": 15, "climate": 15}
NAMES = {
    "internet": "Internet",
    "places": "Places to work",
    "cost": "Cost",
    "safety": "Safety",
    "climate": "Climate",
}
TIERS = (
    (80, "excellent", "Excellent"),
    (65, "good", "Good"),
    (50, "fair", "Fair"),
    (0, "low", "Challenging"),
)

# Coworking text search is only biased toward the city, so it can return spaces far away.
COWORKING_RADIUS_KM = 10
GOOD_RATING = 4.3
POOR_RATING = 3.5
EARLY_MINUTE = 8 * 60
LATE_MINUTE = 18 * 60

ADVISORY_SCORES = {1: 100, 2: 75, 3: 30, 4: 0}

CHEAP_NIGHT_USD = 60
DEAR_NIGHT_USD = 250

COMFORT_HIGH_C = (18.0, 28.0)
COMFORT_FALLOFF_C = 8.0
DRY_RAINY_DAYS = 10.0
WET_RAINY_DAYS = 20.0
SUNNY_HOURS = 2500.0
GLOOMY_HOURS = 1200.0


def tier_for(score: int) -> tuple[str, str]:
    return next((key, label) for floor, key, label in TIERS if score >= floor)


async def get_score(ctx: AppContext, city: City) -> WorkScore:
    async def load() -> dict[str, Any]:
        place_data, stay_data, advisory, climate_data = await asyncio.gather(
            _optional(lambda: places.get_places(ctx, city)),
            _optional(lambda: stays.get_stays(ctx, city, occupants=1)),
            _optional(lambda: essentials.advisory_for(ctx, city)),
            _optional(lambda: climate_service.get_climate(ctx, city, "metric")),
        )
        return combine(
            {
                "internet": internet_factor(get_internet(city)),
                "places": places_factor(city, place_data),
                "cost": cost_factor(stay_data),
                "safety": safety_factor(city, advisory),
                "climate": climate_factor(climate_data),
            }
        ).model_dump()

    data = await ctx.loader.get_or_load(f"score:{city.id}", SCORE_TTL, load)
    return WorkScore.model_validate(data)


async def _optional[T](load: Callable[[], Awaitable[T]]) -> T | None:
    """A failed or unconfigured source leaves its factor out instead of failing the score."""
    try:
        return await load()
    except AppError as exc:
        logger.warning("Score source unavailable: %s", exc)
        return None


def combine(factors: dict[str, tuple[float, str] | None]) -> WorkScore:
    counted = {key: value for key, value in factors.items() if value is not None}
    total_weight = sum(WEIGHTS[key] for key in counted)
    score = None
    if len(counted) >= MIN_FACTORS:
        score = round(sum(WEIGHTS[key] * value[0] for key, value in counted.items()) / total_weight)

    rows = []
    for key, value in factors.items():
        if value is None:
            rows.append(ScoreFactor(key=key, name=NAMES[key], weight=0, score=None, detail=""))
            continue
        weight = round(WEIGHTS[key] * 100 / total_weight)
        rows.append(
            ScoreFactor(key=key, name=NAMES[key], weight=weight, score=round(value[0]), detail=value[1])
        )

    tier, label = tier_for(score) if score is not None else ("none", "")
    return WorkScore(score=score, tier=tier, label=label, counted=len(counted), factors=rows)


def _ramp(value: float, worst: float, best: float) -> float:
    """0 at `worst`, 1 at `best`, straight line between, clamped. Works either way round."""
    if best == worst:
        return 1.0 if value >= best else 0.0
    return min(1.0, max(0.0, (value - worst) / (best - worst)))


def internet_factor(internet: Internet | None) -> tuple[float, str] | None:
    if internet is None:
        return None
    # Mobile stands in for home internet where there are too few home tests.
    main = internet.fixed or internet.mobile
    if main is None:
        return None
    mobile = internet.mobile.download_mbps if internet.mobile else 0
    score = 100 * (
        0.48 * _ramp(main.download_mbps, 0, 100)
        + 0.24 * _ramp(main.upload_mbps, 0, 50)
        + 0.16 * _ramp(main.latency_ms, 100, 20)
        + 0.12 * _ramp(mobile, 0, 50)
    )
    where = "at home" if internet.fixed else "on mobile"
    detail = (
        f"{_mbps(main.download_mbps)} Mbps down, {_mbps(main.upload_mbps)} up, "
        f"{main.latency_ms} ms latency {where}"
    )
    if internet.fixed and internet.mobile:
        detail += f"; {_mbps(internet.mobile.download_mbps)} Mbps on mobile"
    return score, detail


def _mbps(value: float) -> str:
    return f"{value:.0f}" if value >= 10 else f"{value:.1f}"


def places_factor(city: City, data: PlacesResponse | None) -> tuple[float, str] | None:
    if data is None:
        return None
    coworking = [
        p
        for p in data.places
        if p.type == "coworking" and (p.lat is None or p.lng is None or _km(city, p) <= COWORKING_RADIUS_KM)
    ]
    cafes = [p for p in data.places if p.type == "coffee"]
    long_hours = sum(1 for p in cafes if _open_early_or_late(p))

    def quality(group: list[Place]) -> float:
        rated = [p.rating for p in group if p.rating]
        return _ramp(sum(rated) / len(rated), POOR_RATING, GOOD_RATING) if rated else 0.0

    score = (
        40 * _ramp(len(coworking), 0, 10)
        + 20 * quality(coworking)
        + 20 * _ramp(len(cafes), 0, 20)
        + 10 * quality(cafes)
        + 10 * _ramp(long_hours, 0, 3)
    )
    parts = [_count(len(coworking), "coworking space")]
    rated = [p.rating for p in coworking if p.rating]
    if rated:
        parts[0] += f" (avg {sum(rated) / len(rated):.1f}★)"
    parts.append(_count(len(cafes), "café"))
    if long_hours:
        parts.append(f"{long_hours} open early or late")
    return score, ", ".join(parts)


def _count(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _km(city: City, place: Place) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (city.lat, city.lng, place.lat or 0, place.lng or 0))
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _open_early_or_late(place: Place) -> bool:
    """Opens before 8 AM or closes after 6 PM on at least one day."""
    for period in place.opening_hours or []:
        if period.close_minute is None or period.open_minute < EARLY_MINUTE:
            return True
        if period.close_day != period.open_day or period.close_minute > LATE_MINUTE:
            return True
    return False


def cost_factor(data: StaysResponse | None) -> tuple[float, str] | None:
    if data is None or not data.average_price or data.currency != "USD":
        return None
    price = data.average_price
    return 100 * _ramp(
        price, DEAR_NIGHT_USD, CHEAP_NIGHT_USD
    ), f"Average hotel night ${price:,.0f}, a week from now"


def safety_factor(city: City, advisory: Advisory | None) -> tuple[float, str] | None:
    # The State Department publishes no advisory for the US itself.
    if city.country_code == "us":
        return 100, "No US State Dept advisory for the US itself; counted as Level 1"
    if advisory is None or advisory.level not in ADVISORY_SCORES:
        return None
    text = advisory.title.split(":", 1)[1].strip() if ":" in advisory.title else ""
    detail = f"US State Dept advisory: Level {advisory.level}" + (f", {text.lower()}" if text else "")
    return ADVISORY_SCORES[advisory.level], detail


def climate_factor(data: Climate | None) -> tuple[float, str] | None:
    if data is None:
        return None
    months = [m for m in data.months if m.temperature_max is not None]
    if len(months) < 12:
        return None
    low, high = COMFORT_HIGH_C
    comfort_total = 0.0
    comfortable = 0
    sun_hours = 0.0
    sun_known = True
    for m in months:
        t = m.temperature_max or 0
        outside = max(low - t, t - high, 0.0)
        warmth = _ramp(-outside, -COMFORT_FALLOFF_C, 0)
        dryness = _ramp(m.rainy_days or 0, WET_RAINY_DAYS, DRY_RAINY_DAYS)
        comfort_total += warmth * dryness
        comfortable += warmth == 1.0 and dryness == 1.0
        if m.sunshine_hours is None:
            sun_known = False
        else:
            sun_hours += m.sunshine_hours * calendar.monthrange(2001, m.month)[1]

    score = 85 * comfort_total / 12
    detail = f"{comfortable} comfortable month{'' if comfortable == 1 else 's'} a year"
    if sun_known:
        score += 15 * _ramp(sun_hours, GLOOMY_HOURS, SUNNY_HOURS)
        detail += f", {round(sun_hours, -2):,.0f} hours of sun"
    else:
        score = score * 100 / 85
    return score, detail
