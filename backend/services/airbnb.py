# services/airbnb.py
import re
import time
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union

# Initialize logger
logger = logging.getLogger(__name__)

# In-memory cache for Airbnb data
_cache = {}

def parse_price(price_text: Optional[str]) -> float:
    """Helper function to parse price from text"""
    if not price_text:
        return 0

    # Regex to extract the number after the currency symbol
    price_match = re.search(r'[$€£](\d+(?:,\d+)*(?:\.\d+)?)', price_text)
    if price_match:
        price_str = price_match.group(1).replace(',', '')
        try:
            return float(price_str)
        except ValueError:
            pass
    return 0

def fetch_accommodations(
    city_data: Dict[str, Any],
    api_key: str,
    api_url: str,
    occupants: int = 1,
    cache_ttl: int = 7200
) -> Dict[str, Any]:
    """
    Fetch Airbnb pricing information for a city

    Args:
        city_data: Dictionary containing city information (id, name, country, state)
        api_key: Airbnb API key
        api_url: Airbnb API URL
        occupants: Number of occupants (default: 1)
        cache_ttl: Cache time-to-live in seconds (default: 7200 = 2 hours)

    Returns:
        Dictionary with accommodation data including average price and listings
    """
    logger.info(f"Fetching accommodation data for {city_data['name']}, occupants: {occupants}")

    try:
        # Check cache first
        cache_key = f"{city_data['id']}_{occupants}"
        if cache_key in _cache:
            cached_data = _cache[cache_key]
            # Check if cache is still valid
            if time.time() - cached_data.get('timestamp', 0) < cache_ttl:
                logger.info(f"Using cached accommodation data for {cache_key}")
                return cached_data

        # Check if API key is missing
        if not api_key or api_key.startswith("YOUR_"):
            logger.error("Airbnb API key is not configured")
            raise ValueError("Airbnb API key is not configured. Please provide a valid API key.")

        # Ensure occupants is an integer
        try:
            occupants_int = int(occupants)
        except (ValueError, TypeError):
            occupants_int = 1  # Default to 1 if conversion fails

        # Format location based on country
        city_name = city_data['name']
        country = city_data.get('country', '')
        state = city_data.get('state', '')

        location_query = city_name
        if state and country in ["United States of America", "United States"]:
            location_query = f"{city_name}, {state}"
        elif country and country not in ["United States of America", "United States"]:
            location_query = f"{city_name}, {country}"

        # Headers for the RapidAPI
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "airbnb19.p.rapidapi.com"
        }

        # Set up parameters for the API request
        checkin_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        checkout_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")

        params = {
            "query": location_query,
            "checkin": checkin_date,
            "checkout": checkout_date,
            "currency": "USD",
            "adults": occupants_int
        }

        logger.info(f"Making Airbnb API request for {location_query}")

        # Make the API request
        response = requests.get(api_url, headers=headers, params=params, timeout=20)

        if response.status_code != 200:
            logger.error(f"Airbnb API error: Status {response.status_code}")
            raise Exception(f"Airbnb API error: Status {response.status_code}")

        data = response.json()

        # Check if we got valid data in the expected format
        if not data or "status" not in data or not data["status"] or "data" not in data or "list" not in data["data"]:
            logger.error("API response didn't match expected format")
            raise Exception("API response didn't match expected format")

        # Process the listings
        listing_items = data["data"]["list"]
        logger.info(f"Found {len(listing_items)} properties in the API response")

        # Extract the properties with simplified data structure
        accommodations = []
        for item in listing_items:
            listing = item.get("listing", {})
            pricing = item.get("pricingQuote", {})

            # Basic details
            property_id = listing.get("id", "")
            property_name = listing.get("name", "")
            property_type = listing.get("title", "")
            rating = listing.get("avgRatingLocalized", "Not rated")

            # Price information
            stay_price = pricing.get("structuredStayDisplayPrice", {})
            primary_line = stay_price.get("primaryLine", {})

            # Get price value
            price_text = ""
            if "discountedPrice" in primary_line:
                price_text = primary_line.get("discountedPrice", "")
            else:
                price_text = primary_line.get("price", "")

            # Parse price - Airbnb API returns price per night directly
            price_per_night = parse_price(price_text)

            # Get image URL
            image_url = ""
            pictures = listing.get("contextualPictures", [])
            if pictures and len(pictures) > 0:
                image_url = pictures[0].get("picture", "")

            # Get all images for gallery (limited to 5)
            images = []
            for pic in pictures[:5]:
                if "picture" in pic:
                    images.append(pic["picture"])

            # Simplified accommodation object
            accommodations.append({
                "id": property_id,
                "title": property_name,
                "property_type": property_type,
                "rating": rating,
                "price_per_night": round(price_per_night, 2),
                "price_total": price_text,
                "image_url": image_url,
                "images": images,
                "lat": listing.get("coordinate", {}).get("latitude"),
                "lng": listing.get("coordinate", {}).get("longitude"),
                "web_url": listing.get("webURL", "")
            })

        # Calculate average price
        avg_price = 0
        if accommodations:
            avg_price = sum(acc['price_per_night'] for acc in accommodations) / len(accommodations)

        result = {
            "city_id": city_data['id'],
            "city_name": city_data['name'],
            "average_price": round(avg_price, 2),
            "accommodations": accommodations,
            "timestamp": time.time()
        }

        # Cache the result
        _cache[cache_key] = result

        return result

    except Exception as e:
        logger.error(f"Error fetching accommodation data: {str(e)}", exc_info=True)
        return {
            "city_id": city_data.get('id', ''),
            "city_name": city_data.get('name', ''),
            "error": str(e),
            "average_price": 0,
            "accommodations": []
        }

def clear_cache() -> None:
    """Clear the entire accommodation cache"""
    global _cache
    _cache = {}
    logger.info("Airbnb service cache cleared")

def clean_expired_cache(ttl: int = 7200) -> int:
    """
    Remove expired items from the accommodation cache

    Args:
        ttl: Cache time-to-live in seconds (default: 7200 = 2 hours)

    Returns:
        Number of items removed from cache
    """
    now = time.time()
    to_remove = []

    for key, item in _cache.items():
        if now - item.get('timestamp', 0) > ttl:
            to_remove.append(key)

    for key in to_remove:
        del _cache[key]

    logger.info(f"Cleaned {len(to_remove)} expired items from Airbnb service cache")
    return len(to_remove)
