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

# Prioritized countries (with US at top)
PRIORITY_COUNTRIES = {
    'us': 200,    # United States
    'ca': 180,    # Canada
    'gb': 170,    # United Kingdom
    'au': 160,    # Australia
    'nz': 150,    # New Zealand
    'de': 140,    # Germany
    'fr': 130,    # France
    'jp': 125,    # Japan
    'es': 120,    # Spain
    'it': 115,    # Italy
}

# Well-known US states (for further prioritization)
MAJOR_US_STATES = {
    'ca': 50,  # California
    'ny': 50,  # New York
    'fl': 45,  # Florida
    'tx': 45,  # Texas
    'il': 40,  # Illinois
    'pa': 40,  # Pennsylvania
    'ma': 35,  # Massachusetts
    'wa': 35,  # Washington
    'co': 30,  # Colorado
    'or': 30,  # Oregon
    'az': 30,  # Arizona
    'nv': 30,  # Nevada
    'nm': 30,  # New Mexico (specifically boosting for Santa Fe case)
}

# Major cities around the world that should be prioritized
MAJOR_CITIES = {
    'new york': 100,
    'los angeles': 100,
    'chicago': 95,
    'san francisco': 95,
    'boston': 90,
    'seattle': 90,
    'london': 100,
    'paris': 100,
    'tokyo': 100,
    'sydney': 95,
    'rome': 95,
    'berlin': 95,
    'madrid': 90,
    'toronto': 90,
    'vancouver': 90,
    'mexico city': 90,
    'santa fe': 90,  # Specifically boosting Santa Fe
}

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
            'limit': 10  # Increased from 5 to get more candidates for ranking
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
        
        # Log raw API response (sample for debugging)
        logger.debug("Raw API Response (sample):")
        logger.debug(json.dumps(data.get('results', [])[:1], indent=2))
        
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
                      components.get('village') or components.get('state') or
                      components.get('county'))
            
            if not city_name:
                logger.debug(f"Skipping result - no valid city name: {components}")
                continue
            
            country = components.get('country', '')
            country_code = components.get('country_code', '').lower()
            
            if not country_code:
                logger.debug(f"No country code found for {city_name}, using fallback")
                # Try to extract from annotations if available
                if 'annotations' in result and 'country_code' in result['annotations']:
                    country_code = result['annotations']['country_code'].lower()
                else:
                    # Use first 2 chars of country as fallback
                    country_code = country[:2].lower() if country else 'xx'
            
            city_id = f"{city_name.lower().replace(' ', '_')}_{country_code}"
            
            # Create city object
            city = {
                'id': city_id,
                'name': city_name,
                'country': country,
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
        
        # Apply prioritization based on various factors to sort results
        def get_city_priority_score(city):
            score = 0
            city_name = city.get('name', '').lower()
            country = city.get('country', '').lower()
            country_code = city_id.split('_')[-1] if '_' in city.get('id', '') else ''
            state = city.get('state', '').lower()
            
            # 1. Exact name match with query provides a significant boost
            if query.lower() == city_name:
                score += 300
            # Partial match at start of name
            elif city_name.startswith(query.lower()):
                score += 150
            # Query is contained in the city name
            elif query.lower() in city_name:
                score += 100
            
            # 2. Country priority
            if country_code in PRIORITY_COUNTRIES:
                score += PRIORITY_COUNTRIES[country_code]
            
            # 3. US state priority (simplified check)
            if country_code == 'us' and state:
                state_code = state[:2].lower()
                if state_code in MAJOR_US_STATES:
                    score += MAJOR_US_STATES[state_code]
                
                # Special case for Santa Fe, New Mexico
                if city_name.lower() == 'santa fe' and ('new mexico' in state.lower() or 'nm' in state.lower()):
                    score += 200
            
            # 4. Major city priority
            if city_name in MAJOR_CITIES:
                score += MAJOR_CITIES[city_name]
            
            # 5. Favor cities without numbers in their names (likely more prominent)
            if not any(c.isdigit() for c in city_name):
                score += 20
            
            # 6. Presence of state/province info is usually good
            if state:
                score += 10
            
            # 7. Favor shorter, simpler city names (usually more prominent)
            name_length_penalty = min(len(city_name) // 3, 15)  # Penalty grows with length but caps at 15
            score -= name_length_penalty
            
            # 8. If the city is the subject of the formatted address (usually important)
            formatted = city.get('formatted', '').lower()
            if formatted.startswith(city_name):
                score += 30
            
            return score
        
        # Sort cities based on priority score
        cities.sort(key=get_city_priority_score, reverse=True)
        
        # Log found cities with their priority scores
        logger.info(f"Found {len(cities)} valid cities for query: '{query}'")
        for i, city in enumerate(cities[:5]):  # Log just top 5 for brevity
            score = get_city_priority_score(city)
            logger.info(f"  {i+1}. {city['name']} (ID: {city['id']}, Country: {city['country']}, Score: {score})")
        
        # Cache the result
        _cache[cache_key] = {
            'data': cities,
            'timestamp': time.time()
        }
        
        return cities
    
    except Exception as e:
        logger.critical(f"FATAL error searching for city: {str(e)}", exc_info=True)
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
