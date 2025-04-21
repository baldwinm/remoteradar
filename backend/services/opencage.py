# services/opencage.py
import os
import time
import requests
import logging
import json
from typing import Dict, List, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug logging is enabled

# In-memory cache for city searches
_cache = {}

# OpenCage base URL
OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"

def search_city(query: str) -> List[Dict[str, Any]]:
    """
    Search for a city using OpenCage API with comprehensive logging
    
    Args:
        query: Search term for city lookup
        
    Returns:
        List of city objects with name, country, coordinates, etc.
    """
    # Extensive logging of input
    logger.debug("=" * 50)
    logger.debug(f"search_city CALLED with query: '{query}'")
    
    # Validate input
    if not query or len(query) < 2:
        logger.error(f"Invalid query: '{query}'. Query must be at least 2 characters.")
        return []
    
    # Environment variable debugging
    api_key = os.getenv('OPENCAGE_API_KEY', '')
    logger.debug(f"API Key status: {'PRESENT' if api_key and api_key != 'YOUR_OPENCAGE_API_KEY_HERE' else 'MISSING/INVALID'}")
    
    # Check cache first
    cache_key = f"city_search_{query.lower()}"
    if cache_key in _cache:
        logger.debug(f"Cache hit for query: {query}")
        cached_result = _cache[cache_key]
        if time.time() - cached_result['timestamp'] < 604800:
            logger.debug(f"Returning cached results for: {query}")
            return cached_result['data']
    
    # Validate API key
    if not api_key or api_key == "YOUR_OPENCAGE_API_KEY_HERE":
        logger.critical("OpenCage API key is NOT configured!")
        return []
    
    try:
        # Prepare and log API request details
        request_params = {
            'q': query,
            'key': api_key,
            'limit': 5
        }
        logger.debug(f"API Request Parameters: {json.dumps(request_params, indent=2)}")
        
        # Make API request
        response = requests.get(
            OPENCAGE_BASE_URL,
            params=request_params
        )
        
        # Log full response details
        logger.debug(f"API Response Status: {response.status_code}")
        logger.debug(f"API Response Headers: {dict(response.headers)}")
        
        # Handle non-200 response
        if response.status_code != 200:
            logger.error(f"OpenCage API error: {response.status_code}")
            logger.error(f"Response Text: {response.text}")
            return []
        
        # Parse JSON response
        try:
            data = response.json()
        except ValueError as json_err:
            logger.error(f"Failed to parse JSON response: {json_err}")
            logger.error(f"Response text: {response.text}")
            return []
        
        # Log raw API response
        logger.debug("Raw API Response:")
        logger.debug(json.dumps(data, indent=2))
        
        # Validate response structure
        if not data or not data.get('results'):
            logger.warning(f"No results found for query: '{query}'")
            return []
        
        # Process results with extensive logging
        cities = []
        for result in data['results']:
            components = result.get('components', {})
            
            # Get city name or equivalent
            city_name = (components.get('city') or components.get('town') or 
                        components.get('village') or components.get('state'))
            
            if not city_name:
                logger.debug(f"Skipping result - no valid city name: {components}")
                continue
            
            country_code = components.get('country_code', '').lower()
            city_id = f"{city_name.lower().replace(' ', '_')}_{country_code}"
            
            # Create city object
            city = {
                'id': city_id,
                'name': city_name,
                'country': components.get('country', ''),
                'state': components.get('state', ''),
                'lat': result.get('geometry', {}).get('lat'),
                'lng': result.get('geometry', {}).get('lng'),
                'formatted': result.get('formatted', '')
            }
            
            # Validate coordinates
            if city['lat'] is None or city['lng'] is None:
                logger.warning(f"Skipping {city_name} - missing coordinates")
                continue
            
            cities.append(city)
        
        # Log found cities
        logger.info(f"Found {len(cities)} valid cities for query: '{query}'")
        for city in cities:
            logger.info(f"  - {city['name']} (ID: {city['id']}, Coords: {city['lat']}, {city['lng']})")
        
        # Cache the result
        _cache[cache_key] = {
            'data': cities,
            'timestamp': time.time()
        }
        
        return cities
    
    except Exception as e:
        logger.critical(f"FATAL error searching for city: {str(e)}", exc_info=True)
        return []

# Rest of the file remains the same
# ... (keep existing clear_cache and clean_expired_cache functions)
