# services/google_places.py
import os
import time
import requests
import logging
from typing import Dict, List, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)

# In-memory cache
_cache = {
    'places': {},
    'place_details': {}
}

def get_place_details(place_id: str) -> Dict[str, Any]:
    """
    Get detailed information for a specific place using its place_id
    
    Args:
        place_id: Google Place ID
    
    Returns:
        Dictionary with place details (website, phone, maps URL)
    """
    if not place_id:
        logger.warning("Attempt to get place details with empty place_id")
        return {}
        
    # Check cache first
    cache_key = f"place_details_{place_id}"
    if cache_key in _cache['place_details']:
        cache_entry = _cache['place_details'][cache_key]
        # Check if cache is still valid (1 day)
        if time.time() - cache_entry.get('timestamp', 0) < 86400:
            logger.info(f"Using cached place details for {place_id}")
            return cache_entry
    
    try:
        # Get API key from environment
        google_api_key = os.getenv('GOOGLE_API_KEY', '')
        
        # Check if Google API key is configured
        if not google_api_key or google_api_key == "YOUR_GOOGLE_API_KEY_HERE":
            logger.error("Google API key not configured")
            return {}
            
        # Make API request to get place details including the website URL
        details_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={
                "key": google_api_key,
                "place_id": place_id,
                "fields": "website,formatted_phone_number,url"  
            }
        )
        
        if details_response.status_code == 200:
            details_data = details_response.json()
            if details_data and details_data.get('status') == 'OK' and 'result' in details_data:
                result = details_data['result']
                
                # Extract the relevant details
                details = {
                    "website": result.get("website", ""),
                    "formatted_phone_number": result.get("formatted_phone_number", ""),
                    "google_maps_url": result.get("url", ""),
                    "timestamp": time.time()  # Add timestamp for cache expiration
                }
                
                # Cache the details
                _cache['place_details'][cache_key] = details
                logger.info(f"Cached place details for {place_id}")
                
                return details
                
        logger.warning(f"Failed to get place details. Status: {details_response.status_code}")
        return {}
    
    except Exception as e:
        logger.error(f"Error getting place details: {str(e)}", exc_info=True)
        return {}

def get_places_data(city_id: str, city_name: str, lat: float, lng: float) -> Dict[str, Any]:
    """
    Get coffee shops, coworking spaces, and restaurants for a city
    
    Args:
        city_id: Unique identifier for the city
        city_name: Name of the city
        lat: Latitude coordinate
        lng: Longitude coordinate
    
    Returns:
        Dictionary with places data grouped by type
    """
    logger.info(f"Getting places data for city_id: {city_id}, city_name: {city_name}")
    
    try:
        # Check cache first
        if city_id in _cache['places']:
            cached_data = _cache['places'][city_id]
            # Check if cache is still valid (12 hours)
            if time.time() - cached_data.get('timestamp', 0) < 43200:
                logger.info(f"Using cached places data for {city_id}")
                return cached_data
                
        # Get API key from environment
        google_api_key = os.getenv('GOOGLE_API_KEY', '')
        
        # Check if Google API key is configured
        if not google_api_key or google_api_key == "YOUR_GOOGLE_API_KEY_HERE":
            logger.error("Google API key not configured")
            raise Exception("Google API key not configured")
        
        places = []
        place_ids = []  # To collect all place IDs for batch processing later
        
        # Search for coffee shops
        logger.info(f"Searching for coffee shops near {city_name}")
        coffee_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": google_api_key,
                "location": f"{lat},{lng}",
                "radius": 3000,  # 3km radius
                "type": "cafe",
                "keyword": "coffee"
            }
        )
        
        if coffee_response.status_code == 200:
            coffee_data = coffee_response.json()
            if coffee_data and 'results' in coffee_data:
                logger.info(f"Found {len(coffee_data['results'])} coffee shops")
                for place in coffee_data['results']:
                    place_id = place.get("place_id")
                    if place_id:
                        place_ids.append(place_id)
                    
                    places.append({
                        "id": place_id or f"coffee_{len(places)}",
                        "name": place.get("name", "Coffee Shop"),
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating", 0),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "lat": place.get("geometry", {}).get("location", {}).get("lat", lat),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng", lng),
                        "type": "coffee",
                        "website": "",  # Will be filled in later
                        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "",
                        "phone": ""  # Will be filled in later
                    })
        else:
            logger.error(f"Error searching for coffee shops: {coffee_response.status_code}")
        
        # Search for coworking spaces
        logger.info(f"Searching for coworking spaces near {city_name}")
        coworking_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": google_api_key,
                "location": f"{lat},{lng}",
                "radius": 5000,  # 5km radius (wider search for coworking)
                "keyword": "coworking space"
            }
        )
        
        if coworking_response.status_code == 200:
            coworking_data = coworking_response.json()
            if coworking_data and 'results' in coworking_data:
                logger.info(f"Found {len(coworking_data['results'])} coworking spaces")
                for place in coworking_data['results']:
                    place_id = place.get("place_id")
                    if place_id:
                        place_ids.append(place_id)
                    
                    places.append({
                        "id": place_id or f"coworking_{len(places)}",
                        "name": place.get("name", "Coworking Space"),
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating", 0),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "lat": place.get("geometry", {}).get("location", {}).get("lat", lat),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng", lng),
                        "type": "coworking",
                        "website": "",  # Will be filled in later
                        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "",
                        "phone": ""  # Will be filled in later
                    })
        else:
            logger.error(f"Error searching for coworking spaces: {coworking_response.status_code}")
        
        # Search for restaurants
        logger.info(f"Searching for restaurants near {city_name}")
        restaurant_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": google_api_key,
                "location": f"{lat},{lng}",
                "radius": 3000,  # 3km radius
                "type": "restaurant",
                "rankby": "prominence"  # Sort by prominence (rating & popularity)
            }
        )
        
        if restaurant_response.status_code == 200:
            restaurant_data = restaurant_response.json()
            if restaurant_data and 'results' in restaurant_data:
                logger.info(f"Found {len(restaurant_data['results'])} restaurants")
                for place in restaurant_data['results']:
                    place_id = place.get("place_id")
                    if place_id:
                        place_ids.append(place_id)
                    
                    places.append({
                        "id": place_id or f"restaurant_{len(places)}",
                        "name": place.get("name", "Restaurant"),
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating", 0),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "price_level": place.get("price_level", 0),  # Added price level for restaurants
                        "lat": place.get("geometry", {}).get("location", {}).get("lat", lat),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng", lng),
                        "type": "restaurant",
                        "website": "",  # Will be filled in later
                        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "",
                        "phone": ""  # Will be filled in later
                    })
        else:
            logger.error(f"Error searching for restaurants: {restaurant_response.status_code}")
        
        # Count the types of places
        coffee_count = sum(1 for place in places if place['type'] == 'coffee')
        coworking_count = sum(1 for place in places if place['type'] == 'coworking')
        restaurant_count = sum(1 for place in places if place['type'] == 'restaurant')
        
        # Sort places by rating (highest first)
        places.sort(key=lambda x: (x.get('rating', 0), x.get('user_ratings_total', 0)), reverse=True)
        
        # PERFORMANCE OPTIMIZATION: Only fetch details for top-rated places (first page)
        top_places = places[:15]  # Assuming 5 per page, get enough for first 3 pages
        place_details_dict = {}
        
        # Get details for just the top places
        for place in top_places:
            if not place['id'] or place['id'].startswith('place_id:') or '_' in place['id'] and not place['id'].startswith("place_"):
                continue  # Skip if not a valid place_id
                
            # Get place details from cache or API
            details = get_place_details(place['id'])
            if details:
                place_details_dict[place['id']] = details
        
        # Apply the details to the places list
        for place in places:
            if place['id'] in place_details_dict:
                details = place_details_dict[place['id']]
                place['website'] = details.get('website', '')
                place['phone'] = details.get('formatted_phone_number', '')
        
        result = {
            "city_id": city_id,
            "city_name": city_name,
            "places": places,
            "counts": {
                "coffee": coffee_count,
                "coworking": coworking_count,
                "restaurant": restaurant_count,
                "total": len(places)
            },
            "timestamp": time.time()  # Add timestamp for cache expiration
        }
        
        # Cache the result
        _cache['places'][city_id] = result
        logger.info(f"Places data cached for {city_id}")
        return result
    
    except Exception as e:
        logger.error(f"Error getting places data: {str(e)}", exc_info=True)
        return {
            "city_id": city_id,
            "city_name": city_name,
            "error": str(e),
            "places": [],
            "counts": {"coffee": 0, "coworking": 0, "restaurant": 0, "total": 0}
        }

def clear_cache() -> None:
    """Clear the places and place details cache"""
    global _cache
    _cache = {
        'places': {},
        'place_details': {}
    }
    logger.info("Google Places service cache cleared")

def clean_expired_cache() -> int:
    """
    Remove expired items from the cache
    
    Returns:
        Number of items removed from cache
    """
    now = time.time()
    items_removed = 0
    
    # Clean places cache (expires after 12 hours)
    to_remove = []
    for key, item in _cache['places'].items():
        if now - item.get('timestamp', 0) > 43200:  # 12 hours
            to_remove.append(key)
    
    for key in to_remove:
        del _cache['places'][key]
        items_removed += 1
    
    # Clean place details cache (expires after 1 day)
    to_remove = []
    for key, item in _cache['place_details'].items():
        if now - item.get('timestamp', 0) > 86400:  # 1 day
            to_remove.append(key)
    
    for key in to_remove:
        del _cache['place_details'][key]
        items_removed += 1
    
    logger.info(f"Cleaned {items_removed} expired items from Google Places service cache")
    return items_removed
