"""Hotel prices from Booking.com, through the apidojo "Booking" API on RapidAPI."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from ..context import AppContext
from ..errors import AppError, NotFoundError, ServiceNotConfiguredError
from ..http import request_json
from ..models import City, Stay, StaysResponse
from .places import safe_http_url

logger = logging.getLogger(__name__)

RAPIDAPI_HOST = "apidojo-booking-v1.p.rapidapi.com"
AUTOCOMPLETE_URL = f"https://{RAPIDAPI_HOST}/locations/auto-complete"
PROPERTIES_URL = f"https://{RAPIDAPI_HOST}/properties/v2/list"
DEST_ID_TTL = 30 * 24 * 3600
STAYS_TTL = 2 * 3600
# Without a chosen date, prices are quoted for a stay starting this many days from today.
CHECKIN_DAYS_AHEAD = 7
# Booking.com takes reservations up to about a year out.
MAX_DAYS_AHEAD = 360
MAX_NIGHTS = 30


class InvalidDatesError(AppError):
    status_code = 400
    code = "invalid_request"
    public_message = "Pick a check-in date between today and a year from now."


def default_checkin() -> date:
    return datetime.now(UTC).date() + timedelta(days=CHECKIN_DAYS_AHEAD)


async def get_stays(
    ctx: AppContext, city: City, occupants: int, checkin: date | None = None, nights: int = 1
) -> StaysResponse:
    api_key = ctx.settings.rapidapi_key
    if not api_key:
        logger.error("RAPIDAPI_KEY (or AIRBNB_API_KEY) is not set; stays are unavailable")
        raise ServiceNotConfiguredError()

    # "Today" in UTC can be yesterday somewhere, so allow one day of slack.
    today = datetime.now(UTC).date()
    checkin = checkin or default_checkin()
    if not today - timedelta(days=1) <= checkin <= today + timedelta(days=MAX_DAYS_AHEAD):
        raise InvalidDatesError()
    if checkin < today:
        checkin = today
    nights = max(1, min(nights, MAX_NIGHTS))
    checkout = checkin + timedelta(days=nights)

    async def load() -> dict[str, Any]:
        dest_id = await _destination_id(ctx, api_key, city)
        params = {
            "dest_ids": dest_id,
            "search_type": "city",
            "arrival_date": checkin.isoformat(),
            "departure_date": checkout.isoformat(),
            "room_qty": 1,
            "guest_qty": occupants,
            "price_filter_currencycode": "USD",
            "languagecode": "en-us",
            "order_by": "popularity",
            "offset": 0,
        }
        await ctx.usage.spend("booking")
        data = await request_json(
            ctx.http, "Booking", "GET", PROPERTIES_URL, params=params, headers=_headers(api_key)
        )
        cards = [r for r in data.get("result") or [] if r.get("type") == "property_card"]
        stays = [stay for card in cards if (stay := _parse_stay(card))]
        priced = [s.price_per_night for s in stays if s.price_per_night]
        return StaysResponse(
            checkin=checkin.isoformat(),
            checkout=checkout.isoformat(),
            nights=nights,
            occupants=occupants,
            average_price=round(sum(priced) / len(priced), 2) if priced else None,
            currency="USD",
            stays=stays,
        ).model_dump()

    key = f"stays:{city.id}:{occupants}:{checkin.isoformat()}:{nights}"
    data = await ctx.loader.get_or_load(key, STAYS_TTL, load)
    return StaysResponse.model_validate(data)


def _headers(api_key: str) -> dict[str, str]:
    return {"x-rapidapi-key": api_key, "x-rapidapi-host": RAPIDAPI_HOST}


async def _destination_id(ctx: AppContext, api_key: str, city: City) -> str:
    async def load() -> str:
        if city.country_code == "us" and city.state:
            text = f"{city.name}, {city.state}"
        elif city.country:
            text = f"{city.name}, {city.country}"
        else:
            text = city.name
        await ctx.usage.spend("booking")
        results = await request_json(
            ctx.http,
            "Booking",
            "GET",
            AUTOCOMPLETE_URL,
            params={"text": text, "languagecode": "en-us"},
            headers=_headers(api_key),
        )
        if not isinstance(results, list) or not results:
            raise NotFoundError("No hotels found for this city.")
        best = next((r for r in results if r.get("dest_type") == "city"), results[0])
        return str(best.get("dest_id"))

    return await ctx.loader.get_or_load(f"booking-dest:{city.id}", DEST_ID_TTL, load)


def _parse_stay(card: dict[str, Any]) -> Stay | None:
    hotel_id = card.get("hotel_id")
    title = card.get("hotel_name_trans") or card.get("hotel_name")
    if not hotel_id or not title:
        return None

    per_night = (card.get("composite_price_breakdown") or {}).get("gross_amount_per_night") or {}
    price = per_night.get("value")
    image = safe_http_url(card.get("main_photo_url"))
    country = str(card.get("countrycode") or "").lower()

    return Stay(
        id=str(hotel_id),
        title=str(title),
        property_type=str(card.get("accommodation_type_name") or "Hotel"),
        rating=_number(card.get("review_score")),
        rating_word=str(card.get("review_score_word") or ""),
        review_count=int(card.get("review_nr") or 0),
        stars=_number(card.get("class")),
        price_per_night=round(float(price), 2) if price else None,
        currency=str(per_night.get("currency") or card.get("currency_code") or "USD"),
        # The list API returns 60px thumbnails; this size variant is the full photo.
        image_url=image.replace("square60", "max1280x900") if image else None,
        distance_to_center=str(card.get("distance_to_cc_formatted") or ""),
        is_free_cancellable=bool(card.get("is_free_cancellable")),
        has_pool=bool(card.get("has_swimming_pool")),
        url=safe_http_url(card.get("url")) or f"https://www.booking.com/hotel/{country}/{hotel_id}.html",
    )


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number or None
