"""Practical facts for working from a city: exchange rate, public holidays and internet speed.
The time zone and currency themselves come from the geocoder.

Every source here is free and needs no API key. Each one is fetched and cached on its own,
and a failure in one leaves the others intact (the response is marked `partial`).
"""

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from ..context import AppContext
from ..errors import UpstreamError
from ..http import request_json
from ..models import City, Currency, Essentials, Holiday
from .internet import get_internet

logger = logging.getLogger(__name__)

# ExchangeRate-API's open endpoint: daily rates for ~160 currencies, attribution required.
RATES_URL = "https://open.er-api.com/v6/latest/USD"
RATES_TTL = 12 * 3600
# Nager.Date: public holidays for ~120 countries.
HOLIDAYS_URL = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"
HOLIDAYS_TTL = 7 * 24 * 3600
HOLIDAY_WINDOW_DAYS = 60


async def get_essentials(ctx: AppContext, city: City) -> Essentials:
    rates, holidays = await asyncio.gather(
        _usd_rates(ctx),
        _holidays(ctx, city.country_code),
        return_exceptions=True,
    )
    partial = False
    for result in (rates, holidays):
        if isinstance(result, BaseException):
            if not isinstance(result, UpstreamError):
                raise result
            logger.warning("Essentials source failed: %s", result)
            partial = True

    currency = None
    if city.currency_code:
        rate = rates.get(city.currency_code) if isinstance(rates, dict) else None
        currency = Currency(
            code=city.currency_code,
            symbol=city.currency_symbol or city.currency_code,
            name=city.currency_name or city.currency_code,
            usd_rate=rate,
            updated=rates.get("_updated") if isinstance(rates, dict) else None,
        )

    return Essentials(
        timezone=city.timezone,
        currency=currency,
        holidays=None if isinstance(holidays, BaseException) else holidays,
        internet=get_internet(city),
        partial=partial,
    )


async def _usd_rates(ctx: AppContext) -> dict[str, Any]:
    async def load() -> dict[str, Any]:
        data = await request_json(ctx.http, "ExchangeRate-API", "GET", RATES_URL)
        if data.get("result") != "success" or not isinstance(data.get("rates"), dict):
            raise UpstreamError("ExchangeRate-API", "response had no rates")
        rates: dict[str, Any] = {
            str(code): float(value) for code, value in data["rates"].items() if isinstance(value, int | float)
        }
        rates["_updated"] = data.get("time_last_update_utc")
        return rates

    return await ctx.loader.get_or_load("rates:usd", RATES_TTL, load)


async def _holidays(ctx: AppContext, country_code: str) -> list[Holiday] | None:
    if len(country_code) != 2:
        return None
    today = datetime.now(UTC).date()
    until = today + timedelta(days=HOLIDAY_WINDOW_DAYS)
    years = sorted({today.year, until.year})
    per_year = await asyncio.gather(*(_holidays_for_year(ctx, country_code, year) for year in years))
    if all(year is None for year in per_year):
        return None

    upcoming: list[Holiday] = []
    seen: set[tuple[str, str]] = set()
    for items in per_year:
        for item in items or []:
            day = item.get("date", "")
            # Regional holidays (with `counties`) don't apply to the whole country; skip them.
            if not item.get("global", True) or not _within(day, today, until):
                continue
            key = (day, item.get("name", ""))
            if key not in seen:
                seen.add(key)
                upcoming.append(
                    Holiday(
                        date=day,
                        name=str(item.get("name") or ""),
                        local_name=str(item.get("localName") or ""),
                    )
                )
    return sorted(upcoming, key=lambda h: h.date)


async def _holidays_for_year(ctx: AppContext, country_code: str, year: int) -> list[dict[str, Any]] | None:
    async def load() -> dict[str, Any]:
        url = HOLIDAYS_URL.format(year=year, country=country_code.upper())
        try:
            data = await request_json(ctx.http, "Nager.Date", "GET", url)
        except UpstreamError as exc:
            # 404 means an unsupported country; 204 (no body, so "not valid JSON") means no data.
            if exc.upstream_status in (204, 404):
                return {"items": None}
            raise
        return {"items": data if isinstance(data, list) else None}

    cached = await ctx.loader.get_or_load(f"holidays:{country_code}:{year}", HOLIDAYS_TTL, load)
    return cached["items"]


def _within(day: str, start: date, end: date) -> bool:
    try:
        parsed = date.fromisoformat(day)
    except ValueError:
        return False
    return start <= parsed <= end
