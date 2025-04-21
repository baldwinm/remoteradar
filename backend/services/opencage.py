# services/opencage.py
import os
import time
import requests
import logging
from typing import Dict, List, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)

# In-memory cache for city searches
_cache = {}

# OpenCage base URL
OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"

def search_city(query: str) -> List[Dict[str, Any]]:
    """
    Search for a city using OpenCage API
    
    Args:
        query: Search term for city lookup
        
    Returns:
        List of city objects with name, country, coordinates, etc.
    """
    logger.info(f"Searching for city with query: '{query}'")
    
    if not query or len(query) < 2:
        logger.warning(f"Query too short: '{query}'")
        return []
    
    # Check cache first
    cache_key = f"city_search_{query.lower()}"
    if cache_key in _cache:
        logger.info(f"Using cached city search for {query}")
        cached_result = _cache[cache_key]
        # Check if cache is still valid (7 days)
        if time.time() - cached_result['timestamp'] < 604800:
            return cached_result['data']
    
    # Get API key from environment
    api_key = os.getenv('OPENCAGE_API_KEY', '')
    
    if not api_key or api_key == "YOUR_OPENCAGE_API_KEY_HERE":
        logger.error("OpenCage API key not configured")
        return []
    
    try:
        # Make API request
        response = requests.get(
            OPENCAGE_BASE_URL,
            params={
                'q': query,
                'key': api_key,
                'limit': 5  
            }
        )
        
        if response.status_code != 200:
            logger.error(f"OpenCage API error: {response.status_code}")
            return []
        
        data = response.json()
        
        if not data or not data.get('results'):
            logger.info(f"No results found for query: '{query}'")
            return []
        
        # Process results
        cities = []
        for result in data['results']:
            components = result.get('components', {})
            
            # Get city name or equivalent
            city_name = (components.get('city') or components.get('town') or 
                        components.get('village') or components.get('state'))
            
            if not city_name:
                continue
                
            country_code = components.get('country_code', '').lower()
            city_id = f"{city_name.lower().replace(' ', '_')}_{country_code}"
            
            cities.append({
                'id': city_id,
                'name': city_name,
                'country': components.get('country', ''),
                'state': components.get('state', ''),
                'lat': result.get('geometry', {}).get('lat'),
                'lng': result.get('geometry', {}).get('lng'),
                'formatted': result.get('formatted', '')
            })
        
        logger.info(f"Found {len(cities)} cities for query: '{query}'")
        for city in cities:
            logger.info(f"  - {city['name']} ({city['id']})")
        
        # Cache the result
        _cache[cache_key] = {
            'data': cities,
            'timestamp': time.time()
        }
        
        return cities
    except Exception as e:
        logger.error(f"Error searching for city: {str(e)}", exc_info=True)
        return []

def clear_cache() -> None:
    """Clear the city search cache"""
    global _cache
    _cache = {}
    logger.info("OpenCage city search cache cleared")

def clean_expired_cache() -> int:
    """
    Remove expired items from the cache
    
    Returns:
        Number of items removed from cache
    """
    now = time.time()
    to_remove = []
    
    # Clean city search cache (expires after 7 days)
    for key, item in _cache.items():
        if now - item.get('timestamp', 0) > 604800:  # 7 days
            to_remove.append(key)
    
    for key in to_remove:
        del _cache[key]
    
    logger.info(f"Cleaned {len(to_remove)} expired items from OpenCage city search cache")
    return len(to_remove)
