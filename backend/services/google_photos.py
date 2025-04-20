# services/google_photos.py
import os
import time
import requests
import logging
import random
from typing import Dict, List, Any, Optional, Union

# Initialize logger
logger = logging.getLogger(__name__)

# In-memory cache for city images
_cache = {}

# Special overrides for problematic cities
CITY_OVERRIDES = {
    # Format: 'city_state_country': {override properties}
    'lafayette_la_us': {
        'search_queries': [
            "downtown lafayette louisiana",
            "lafayette louisiana downtown",
            "lafayette louisiana main street",
            "lafayette louisiana city hall",
            "lafayette louisiana city"
        ],
        'blacklist_keywords': [
            "church", "cathedral", "st john", "saint john", "religious", 
            "worship", "chapel", "parish"
        ],
        'radius': 10000  # Smaller radius to focus on downtown
    },
    'lafayette_louisiana_us': {
        'search_queries': [
            "downtown lafayette louisiana",
            "lafayette louisiana downtown",
            "lafayette louisiana main street",
            "lafayette louisiana city hall",
            "lafayette louisiana city"
        ],
        'blacklist_keywords': [
            "church", "cathedral", "st john", "saint john", "religious", 
            "worship", "chapel", "parish"
        ],
        'radius': 10000  # Smaller radius to focus on downtown
    }
}

def get_city_photo(
    city: str, 
    state: str = '', 
    country: str = '', 
    lat: Optional[float] = None, 
    lng: Optional[float] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get a representative photo for a city using Google Places API
    
    Args:
        city: Name of the city
        state: State name (optional)
        country: Country name (optional)
        lat: Latitude coordinate (optional)
        lng: Longitude coordinate (optional)
        api_key: Google API key (optional, will use env var if not provided)
        
    Returns:
        Dictionary with image data
    """
    # Create a cache key
    coords_part = f"_{lat}_{lng}" if lat is not None and lng is not None else ""
    cache_key = f"city_image_{city.lower()}_{state.lower()}_{country.lower()}{coords_part}"
    
    # Check if we should clear cache for this city to force a new search
    force_refresh = request_args_get("forceRefresh", "false").lower() == "true"
    
    # Check cache first (unless forced refresh)
    if not force_refresh and cache_key in _cache:
        cached_data = _cache[cache_key]
        # Check if cache is still valid (1 day)
        if time.time() - cached_data.get('timestamp', 0) < 86400:
            logger.info(f"Using cached city photo for {city}")
            return cached_data
    
    # Get API key from environment if not provided
    google_api_key = api_key or os.getenv('GOOGLE_API_KEY', '')
    
    if not google_api_key or google_api_key == "YOUR_GOOGLE_API_KEY_HERE":
        logger.error("Google API key not configured")
        raise ValueError("Google API key not configured")
    
    try:
        # Check if this city has special override settings
        city_key = f"{city.lower()}_{state.lower()}_{country.lower()}"
        city_key_alt = f"{city.lower()}_{state.lower()}"
        
        # Try both the full key and the shorter key
        override = CITY_OVERRIDES.get(city_key) or CITY_OVERRIDES.get(city_key_alt)
        
        place_id = None
        
        # Use special handling for cities with overrides
        if override:
            logger.info(f"Using special override for {city_key}")
            
            # Try each override query in sequence
            for query in override.get('search_queries', []):
                place_id = find_city_landmark_with_filter(
                    query, 
                    override.get('blacklist_keywords', []),
                    lat, 
                    lng, 
                    google_api_key,
                    radius=override.get('radius', 50000)
                )
                
                if place_id:
                    logger.info(f"Found place_id using override query: {query}")
                    break
        
        # If no override or override didn't work, use the regular approach
        if not place_id:
            # Try multiple search types to get a representative city image
            search_terms = [
                "downtown", "skyline", "city center", "city hall", 
                "main street", "town square", "city view"
            ]
            
            for term in search_terms:
                place_id = find_city_landmark(city, state, country, term, lat, lng, google_api_key)
                if place_id:
                    break
                
            # If still nothing, try the city name directly as a fallback
            if not place_id:
                place_id = find_city_place_id(city, state, country, lat, lng, google_api_key)
        
        if not place_id:
            logger.error(f"Could not find place ID for {city}")
            raise ValueError(f"Could not find place ID for {city}")
        
        # Now get a photo reference for this place
        photo_reference = get_place_photo_reference(place_id, google_api_key)
        
        if not photo_reference:
            logger.error(f"No photos available for {city} (place_id: {place_id})")
            raise ValueError(f"No photos available for {city}")
        
        # Generate photo URLs
        photo_data = {
            "success": True,
            "url": f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={photo_reference}&key={google_api_key}",
            "small_url": f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference={photo_reference}&key={google_api_key}",
            "thumb_url": f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference={photo_reference}&key={google_api_key}",
            "attribution": {
                "name": "Google",
                "username": "Google",
                "link": "https://maps.google.com/"
            },
            "google_maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}",
            "place_id": place_id,
            "timestamp": time.time()
        }
        
        # Cache the result
        _cache[cache_key] = photo_data
        
        logger.info(f"Successfully retrieved Google photo for {city}")
        return photo_data
    
    except Exception as e:
        logger.error(f"Error getting Google photo for {city}: {str(e)}", exc_info=True)
        raise

def request_args_get(key, default=''):
    """Helper to get a request parameter from Flask if available"""
    try:
        from flask import request
        return request.args.get(key, default)
    except:
        return default

def find_city_landmark_with_filter(
    search_query: str,
    blacklist_keywords: List[str] = [],
    lat: Optional[float] = None, 
    lng: Optional[float] = None, 
    api_key: str = '',
    radius: int = 50000
) -> str:
    """
    Find a place ID for a specific search query with extra keyword filtering
    
    Args:
        search_query: Complete search query
        blacklist_keywords: Keywords to filter out results
        lat: Latitude
        lng: Longitude
        api_key: Google API key
        radius: Search radius in meters
        
    Returns:
        Place ID string
    """
    logger.info(f"Searching with custom filter: '{search_query}'")
    
    try:
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            "query": search_query,
            "key": api_key
        }
        
        # Add location if available
        if lat is not None and lng is not None:
            params["location"] = f"{lat},{lng}"
            params["radius"] = radius
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("status") == "OK" and data.get("results"):
                # Filter for results with photos
                results_with_photos = [r for r in data["results"] if "photos" in r]
                
                if not results_with_photos:
                    # No results with photos, try all results
                    results_with_photos = data["results"]
                
                # Apply blacklist filtering
                for result in results_with_photos:
                    name = result.get("name", "").lower()
                    
                    # Skip if name contains any blacklisted keyword
                    if any(keyword.lower() in name.lower() for keyword in blacklist_keywords):
                        logger.info(f"Skipping blacklisted result: {name}")
                        continue
                    
                    # Skip specific types of places
                    types = result.get("types", [])
                    skip_types = ["church", "place_of_worship", "cemetery", "funeral_home", "mosque", "synagogue"]
                    if any(skip_type in types for skip_type in skip_types):
                        logger.info(f"Skipping place with type in skip list: {name}, types: {types}")
                        continue
                    
                    # If we get here, this should be a good representative image
                    logger.info(f"Found good representative image: {result.get('name', '')}")
                    return result["place_id"]
                
                # If no filtered results worked, just use the first result
                if results_with_photos:
                    logger.info(f"Using first available result: {results_with_photos[0].get('name', '')}")
                    return results_with_photos[0]["place_id"]
    except Exception as e:
        logger.warning(f"Error in custom search: {str(e)}")
    
    # Return empty string if nothing found
    return ""

def find_city_landmark(
    city: str, 
    state: str = '', 
    country: str = '', 
    landmark_type: str = 'downtown',
    lat: Optional[float] = None, 
    lng: Optional[float] = None, 
    api_key: str = ''
) -> str:
    """
    Find a place ID for a specific city landmark or area
    
    Args:
        city: City name
        state: State name
        country: Country name
        landmark_type: Type of landmark to search for ("downtown", "skyline", etc.)
        lat: Latitude
        lng: Longitude
        api_key: Google API key
        
    Returns:
        Place ID string
    """
    # Build the search query
    base_query = city
    if state:
        base_query += f" {state}"
    if country and country.lower() not in base_query.lower(): 
        base_query += f" {country}"
    
    # Create a query that prioritizes cityscape images
    search_query = f"{landmark_type} {base_query}"
    
    logger.info(f"Searching for landmark: '{search_query}'")
    
    # Standard blacklist keywords for all searches
    blacklist_keywords = [
        "church", "cathedral", "religious", "worship", "chapel", "parish",
        "temple", "mosque", "synagogue", "cemetery", "memorial", "shrine"
    ]
    
    return find_city_landmark_with_filter(
        search_query, 
        blacklist_keywords,
        lat, 
        lng, 
        api_key
    )

def find_city_place_id(
    city: str, 
    state: str = '', 
    country: str = '', 
    lat: Optional[float] = None, 
    lng: Optional[float] = None, 
    api_key: str = ''
) -> str:
    """
    Find a Google Place ID for a city, prioritizing places with photos
    
    Args:
        city: City name
        state: State name
        country: Country name
        lat: Latitude
        lng: Longitude
        api_key: Google API key
        
    Returns:
        Place ID string
    """
    # Build the search query
    query = city
    if state:
        query += f" {state}"
    if country:
        query += f" {country}"
    
    # Standard blacklist keywords
    blacklist_keywords = [
        "church", "cathedral", "religious", "worship", "chapel", "parish",
        "temple", "mosque", "synagogue", "cemetery", "memorial", "shrine"
    ]
    
    # Try text search for the city
    try:
        return find_city_landmark_with_filter(
            query,
            blacklist_keywords,
            lat,
            lng,
            api_key
        )
    except Exception as e:
        logger.warning(f"Error in city text search: {str(e)}")
    
    # Third attempt: Try a broader search with just the city name
    try:
        return find_city_landmark_with_filter(
            city,
            blacklist_keywords,
            lat,
            lng,
            api_key
        )
    except Exception as e:
        logger.warning(f"Error in broad city search: {str(e)}")
    
    # If all else fails, return empty string
    return ""

def get_place_photo_reference(place_id: str, api_key: str) -> str:
    """
    Get a photo reference for a place ID
    
    Args:
        place_id: Google Place ID
        api_key: Google API key
        
    Returns:
        Photo reference string
    """
    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "fields": "photos",
            "key": api_key
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if (data.get("status") == "OK" and 
                    data.get("result") and 
                    data["result"].get("photos") and 
                    len(data["result"]["photos"]) > 0):
                
                # Get a random photo from the first few (usually the first few are better quality)
                photos = data["result"]["photos"]
                selected_photo = random.choice(photos[:min(3, len(photos))])
                
                return selected_photo.get("photo_reference", "")
    
    except Exception as e:
        logger.error(f"Error getting place photos: {str(e)}", exc_info=True)
    
    return ""

def clear_cache() -> None:
    """Clear the city photos cache"""
    global _cache
    _cache = {}
    logger.info("Google city photos cache cleared")

def clean_expired_cache() -> int:
    """
    Remove expired items from the cache
    
    Returns:
        Number of items removed from cache
    """
    now = time.time()
    to_remove = []
    
    # Clean city photos cache (expires after 1 day)
    for key, item in _cache.items():
        if now - item.get('timestamp', 0) > 86400:  # 1 day
            to_remove.append(key)
    
    for key in to_remove:
        del _cache[key]
    
    logger.info(f"Cleaned {len(to_remove)} expired items from Google city photos cache")
    return len(to_remove)
