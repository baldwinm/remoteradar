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
    logger.debug(f"get_weather_data called with: lat={lat}, lng={lng}, units={units}")
    
    try:
        # Validate input parameters
        if lat is None or lng is None:
            logger.error(f"Invalid coordinates: lat={lat}, lng={lng}")
            return {"error": f"Invalid coordinates: lat={lat}, lng={lng}"}
        
        # Ensure coordinates are converted to float
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
        
        # Prepare API request parameters
        params = {
            'latitude': lat,
            'longitude': lng,
            'current': 'temperature,relative_humidity,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
            'hourly': 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
            'timezone': 'auto',
            'forecast_days': 3
        }
        
        # Add temperature unit parameter based on units
        if units == 'imperial':
            params['temperature_unit'] = 'fahrenheit'
            params['wind_speed_unit'] = 'mph'
            params['precipitation_unit'] = 'inch'
        
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
            logger.debug(f"API Response Status Code: {response.status_code}")
            logger.debug(f"API Response Headers: {response.headers}")
            
            # Detailed error handling
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
            
            # Log parsed data structure
            logger.debug("Parsed API Response Structure:")
            logger.debug(f"Keys in response: {list(data.keys())}")
            
            # Process the API response
            processed_data = process_weather_data(data, units)
            
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

# Rest of the file remains the same as in the original implementation
# ... (keep other functions like process_weather_data, get_weather_condition, etc.)
