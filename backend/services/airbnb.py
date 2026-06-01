# services/airbnb.py
import re
import time
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)

# In-memory cache
_cache = {}

RAPIDAPI_HOST = "apidojo-booking-v1.p.rapidapi.com"


def _get_headers(api_key: str) -> Dict:
    return {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": RAPIDAPI_HOST
    }


def _get_dest_id(city_name: str, country: str, state: str, api_key: str) -> Optional[str]:
    """Look up Booking.com dest_id for a city using autocomplete."""
    if state and country in ["United States of America", "United States"]:
        search_term = f"{city_name}, {state}"
    elif country:
        search_term = f"{city_name}, {country}"
    else:
        search_term = city_name

    try:
        response = requests.get(
            f"https://{RAPIDAPI_HOST}/locations/auto-complete",
            headers=_get_headers(api_key),
            params={"text": search_term, "languagecode": "en-us"},
            timeout=10
        )
        if response.status_code != 200:
            logger.error(f"Autocomplete API error: {response.status_code}")
            return None

        results = response.json()
        if not results:
            logger.warning(f"No autocomplete results for: {search_term}")
            return None

        for result in results:
            if result.get("dest_type") == "city":
                dest_id = result.get("dest_id")
                logger.info(f"Found dest_id {dest_id} for {search_term}")
                return str(dest_id)

        dest_id = results[0].get("dest_id")
        logger.info(f"Using first result dest_id {dest_id} for {search_term}")
        return str(dest_id)

    except Exception as e:
        logger.error(f"Autocomplete lookup failed: {e}")
        return None


def fetch_accommodations(
    city_data: Dict[str, Any],
    api_key: str,
    api_url: str,
    occupants: int = 1,
    cache_ttl: int = 7200
) -> Dict[str, Any]:
    """
    Fetch hotel pricing for a city via Booking.com (apidojo RapidAPI).
    """
    city_name = city_data.get("name", "")
    city_id = city_data.get("id", "")
    country = city_data.get("country", "")
    state = city_data.get("state", "")

    logger.info(f"Fetching accommodation data for {city_name}, occupants: {occupants}")

    try:
        cache_key = f"{city_id}_{occupants}"
        if cache_key in _cache:
            cached = _cache[cache_key]
            if time.time() - cached.get("timestamp", 0) < cache_ttl:
                logger.info(f"Using cached accommodation data for {cache_key}")
                return cached

        if not api_key or api_key.startswith("YOUR_"):
            raise ValueError("Accommodation API key is not configured.")

        try:
            occupants_int = int(occupants)
        except (ValueError, TypeError):
            occupants_int = 1

        dest_id = _get_dest_id(city_name, country, state, api_key)
        if not dest_id:
            raise Exception(f"Could not find destination ID for {city_name}")

        checkin = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        checkout = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")

        params = {
            "dest_ids": dest_id,
            "search_type": "city",
            "arrival_date": checkin,
            "departure_date": checkout,
            "room_qty": 1,
            "guest_qty": occupants_int,
            "price_filter_currencycode": "USD",
            "languagecode": "en-us",
            "order_by": "popularity",
            "offset": 0
        }

        logger.info(f"Fetching properties for dest_id={dest_id}, checkin={checkin}")
        response = requests.get(
            f"https://{RAPIDAPI_HOST}/properties/v2/list",
            headers=_get_headers(api_key),
            params=params,
            timeout=20
        )

        if response.status_code != 200:
            raise Exception(f"Properties API error: {response.status_code}")

        data = response.json()
        raw_results = data.get("result", [])

        property_cards = [r for r in raw_results if r.get("type") == "property_card"]
        logger.info(f"Found {len(property_cards)} properties for {city_name}")

        accommodations = []
        for prop in property_cards:
            price_breakdown = prop.get("composite_price_breakdown", {})
            per_night = price_breakdown.get("gross_amount_per_night", {})
            price_per_night = per_night.get("value", 0)

            raw_url = prop.get("main_photo_url", "")
            image_url = raw_url.replace("square60", "max1280x900")

            accommodations.append({
                "id": str(prop.get("hotel_id", "")),
                "title": prop.get("hotel_name_trans") or prop.get("hotel_name", ""),
                "property_type": prop.get("accommodation_type_name", "Hotel"),
                "rating": prop.get("review_score", 0),
                "rating_word": prop.get("review_score_word", ""),
                "review_count": prop.get("review_nr", 0),
                "stars": prop.get("class", 0),
                "price_per_night": round(price_per_night, 2),
                "price_total": prop.get("min_total_price", 0),
                "currency": prop.get("currency_code", "USD"),
                "image_url": image_url,
                "images": [image_url] if image_url else [],
                "lat": prop.get("latitude"),
                "lng": prop.get("longitude"),
                "distance_to_center": prop.get("distance_to_cc_formatted", ""),
                "is_free_cancellable": bool(prop.get("is_free_cancellable", 0)),
                "has_pool": bool(prop.get("has_swimming_pool", 0)),
                "web_url": f"https://www.booking.com/hotel/{prop.get('countrycode', '')}/{prop.get('hotel_id', '')}.html"
            })

        avg_price = 0
        priced = [a for a in accommodations if a["price_per_night"] > 0]
        if priced:
            avg_price = sum(a["price_per_night"] for a in priced) / len(priced)

        result = {
            "city_id": city_id,
            "city_name": city_name,
            "average_price": round(avg_price, 2),
            "accommodations": accommodations,
            "timestamp": time.time()
        }

        _cache[cache_key] = result
        return result

    except Exception as e:
        logger.error(f"Error fetching accommodation data: {str(e)}", exc_info=True)
        return {
            "city_id": city_id,
            "city_name": city_name,
            "error": str(e),
            "average_price": 0,
            "accommodations": []
        }


def clear_cache() -> None:
    global _cache
    _cache = {}
    logger.info("Accommodation cache cleared")


def clean_expired_cache(ttl: int = 7200) -> int:
    now = time.time()
    to_remove = [k for k, v in _cache.items() if now - v.get("timestamp", 0) > ttl]
    for k in to_remove:
        del _cache[k]
    logger.info(f"Cleaned {len(to_remove)} expired items from accommodation cache")
    return len(to_remove)
