# services/weather.py
import os
import time
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug logging is enabled

# In-memory cache
_cache = {}

# Open-Meteo base URL
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"

def get_weather_data(lat: float, lng: float, units: str = 'metric') -> Dict[str, Any]:
    """
    Get weather data for a location using Open-Meteo API
    
    Args:
        lat: Latitude
        lng: Longitude
        units: Units (metric, imperial)
        
    Returns:
        Dictionary with weather data including current conditions and forecast
    """
    # Extensive logging of input parameters
    logger.debug(f"get_weather_data CALLED with: lat={lat}, lng={lng}, units={units}")
    
    try:
        # Validate input parameters
        if lat is None or lng is None:
            logger.error(f"Invalid coordinates: lat={lat}, lng={lng}")
            return {"error": f"Invalid coordinates: lat={lat}, lng={lng}"}
        
        # Ensure coordinates are converted to float and within valid ranges
        try:
            lat = float(lat)
            lng = float(lng)
        except (TypeError, ValueError) as conv_err:
            logger.error(f"Failed to convert coordinates: {conv_err}")
            return {"error": f"Could not convert coordinates: {conv_err}"}
        
        # Validate coordinate ranges
        if abs(lat) > 90 or abs(lng) > 180:
            logger.error(f"Coordinates out of valid range: lat={lat}, lng={lng}")
            return {"error": f"Coordinates out of valid range: lat={lat}, lng={lng}"}
        
        # Create cache key
        cache_key = f"weather_{lat}_{lng}_{units}"
        
        # Check cache (valid for 1 hour)
        if cache_key in _cache:
            cache_entry = _cache[cache_key]
            if time.time() - cache_entry.get('timestamp', 0) < 3600:
                logger.debug(f"Using cached weather data for {cache_key}")
                return cache_entry.get('data', {})
        
        # Prepare simplified API request parameters
        params = {
            'latitude': lat,
            'longitude': lng,
            'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min',
            'timezone': 'auto',
            'forecast_days': 3
        }
        
        # Add temperature unit parameter based on units
        if units == 'imperial':
            params['temperature_unit'] = 'fahrenheit'
        
        # Log full request parameters for debugging
        logger.debug(f"Open-Meteo API Request Parameters: {params}")
        
        # Make API request with comprehensive error handling
        try:
            response = requests.get(
                OPEN_METEO_BASE_URL,
                params=params,
                timeout=10
            )
            
            # Log full response details
            logger.debug(f"API Response Status: {response.status_code}")
            
            # Handle non-200 response
            if response.status_code != 200:
                logger.error(f"Open-Meteo API error: {response.status_code}")
                logger.error(f"Response Body: {response.text}")
                return {
                    "error": f"Failed to fetch weather data: {response.status_code}",
                    "response_body": response.text,
                    "request_params": params
                }
            
            # Parse JSON response
            try:
                data = response.json()
            except ValueError as json_err:
                logger.error(f"Failed to parse JSON response: {json_err}")
                logger.error(f"Response text: {response.text}")
                return {
                    "error": "Failed to parse weather data",
                    "response_body": response.text
                }
            
            # Validate response structure
            required_keys = ['current', 'daily']
            for key in required_keys:
                if key not in data:
                    logger.error(f"Missing required key in response: {key}")
                    return {
                        "error": f"Incomplete weather data: missing {key}",
                        "response_body": data
                    }
            
            # Process the API response
            processed_data = process_simplified_weather_data(data, units)
            
            # Cache the result
            _cache[cache_key] = {
                'data': processed_data,
                'timestamp': time.time()
            }
            
            return processed_data
        
        except requests.RequestException as req_err:
            logger.error(f"Request Exception: {str(req_err)}")
            return {
                "error": f"Network error: {str(req_err)}",
                "request_params": params
            }
        
    except Exception as e:
        logger.error(f"Unexpected error in get_weather_data: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "details": {
                "latitude": lat,
                "longitude": lng,
                "units": units
            }
        }

def process_simplified_weather_data(data: Dict[str, Any], units: str) -> Dict[str, Any]:
    """
    Process raw API response into a more usable format with simplified data
    
    Args:
        data: Raw API response
        units: Units (metric, imperial)
        
    Returns:
        Processed weather data
    """
    # Extensive logging for debugging
    logger.debug(f"Processing weather data: {data}")
    
    # Validate input data
    if not data or 'current' not in data or 'daily' not in data:
        logger.error("Invalid or incomplete weather data received")
        return {
            'error': 'No weather data available',
            'current': {},
            'daily': [],
            'units': units
        }
    
    # Extract current weather
    current = data.get('current', {})
    
    # Get weather code
    try:
        weather_code = current.get('weather_code')
        
        # Get condition description
        condition = get_weather_condition(weather_code)
        
        current_weather = {
            'temp': current.get('temperature_2m', 'N/A'),
            'feels_like': current.get('apparent_temperature', 'N/A'),
            'humidity': current.get('relative_humidity_2m', 'N/A'),
            'weather': condition,
            'description': condition,
            'weather_code': weather_code,
        }
    except Exception as e:
        logger.error(f"Error processing current weather: {e}")
        current_weather = {
            'temp': 'N/A',
            'feels_like': 'N/A',
            'humidity': 'N/A',
            'weather': 'Unknown',
            'description': 'Unknown',
            'weather_code': None,
        }
    
    # Process daily forecast
    daily = data.get('daily', {})
    dates = daily.get('time', [])
    daily_data = []
    
    try:
        for i in range(len(dates)):
            try:
                weather_code = daily.get('weather_code', [])[i] if i < len(daily.get('weather_code', [])) else None
                condition = get_weather_condition(weather_code)
                
                day_data = {
                    'date': dates[i],
                    'day_name': datetime.strptime(dates[i], '%Y-%m-%d').strftime('%A'),
                    'temp_max': daily.get('temperature_2m_max', [])[i] if i < len(daily.get('temperature_2m_max', [])) else 'N/A',
                    'temp_min': daily.get('temperature_2m_min', [])[i] if i < len(daily.get('temperature_2m_min', [])) else 'N/A',
                    'feels_like_max': daily.get('apparent_temperature_max', [])[i] if i < len(daily.get('apparent_temperature_max', [])) else 'N/A',
                    'feels_like_min': daily.get('apparent_temperature_min', [])[i] if i < len(daily.get('apparent_temperature_min', [])) else 'N/A',
                    'condition': condition,
                    'weather_code': weather_code,
                }
                
                daily_data.append(day_data)
            except Exception as day_err:
                logger.error(f"Error processing daily forecast for index {i}: {day_err}")
    except Exception as e:
        logger.error(f"Error processing daily forecast: {e}")
    
    # Build result (only include current and next two days)
    result = {
        'current': current_weather,
        'daily': daily_data[:3],  # Only include current and next two days
        'units': units,
        'latitude': data.get('latitude', 'N/A'),
        'longitude': data.get('longitude', 'N/A'),
        'timezone': data.get('timezone', 'N/A'),
    }
    
    # Log the final processed result for debugging
    logger.debug(f"Processed weather data: {result}")
    
    return result

def get_weather_condition(code: int) -> str:
    """
    Map WMO weather codes to condition descriptions
    
    Args:
        code: WMO weather code
        
    Returns:
        Weather condition description
    """
    if code is None:
        return "Unknown"
    
    # Map from WMO codes to conditions
    # See: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
    
    # Clear
    if code == 0:
        return "Clear"
    
    # Mainly clear, partly cloudy
    if code in [1, 2, 3]:
        return "Partly cloudy"
    
    # Fog, depositing rime fog
    if code in [45, 48]:
        return "Fog"
    
    # Drizzle: light, moderate, and dense intensity
    if code in [51, 53, 55]:
        return "Drizzle"
    
    # Freezing Drizzle: light and dense intensity
    if code in [56, 57]:
        return "Freezing drizzle"
    
    # Rain: slight, moderate and heavy intensity
    if code in [61, 63, 65]:
        return "Rain"
    
    # Freezing Rain: light and heavy intensity
    if code in [66, 67]:
        return "Freezing rain"
    
    # Snow fall: slight, moderate, and heavy intensity
    if code in [71, 73, 75]:
        return "Snow"
    
    # Snow grains
    if code == 77:
        return "Snow grains"
    
    # Rain showers: slight, moderate, and violent
    if code in [80, 81, 82]:
        return "Rain showers"
    
    # Snow showers slight and heavy
    if code in [85, 86]:
        return "Snow showers"
    
    # Thunderstorm: slight or moderate
    if code == 95:
        return "Thunderstorm"
    
    # Thunderstorm with slight and heavy hail
    if code in [96, 99]:
        return "Thunderstorm with hail"
    
    # Default for unmatched codes
    return "Unknown"

def clear_cache() -> None:
    """Clear the weather cache"""
    global _cache
    _cache = {}
    logger.info("Weather service cache cleared")

def clean_expired_cache() -> int:
    """
    Remove expired items from the cache
    
    Returns:
        Number of items removed from cache
    """
    now = time.time()
    to_remove = []
    
    # Clean weather cache (expires after 1 hour)
    for key, item in _cache.items():
        if now - item.get('timestamp', 0) > 3600:
            to_remove.append(key)
    
    for key in to_remove:
        del _cache[key]
    
    logger.info(f"Cleaned {len(to_remove)} expired items from weather cache")
    return len(to_remove)