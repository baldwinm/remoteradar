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
        
        # Set temperature unit based on requested units
        temperature_unit = 'fahrenheit' if units == 'imperial' else 'celsius'
        wind_speed_unit = 'mph' if units == 'imperial' else 'kmh'
        precipitation_unit = 'inch' if units == 'imperial' else 'mm'
        
        # Prepare API request parameters
        params = {
            'latitude': lat,
            'longitude': lng,
            'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
            'hourly': 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
            'timezone': 'auto',
            'forecast_days': 3,
            'temperature_unit': temperature_unit,
            'wind_speed_unit': wind_speed_unit,
            'precipitation_unit': precipitation_unit
        }
        
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
            logger.debug(f"API Response Headers: {dict(response.headers)}")
            logger.debug(f"API Response Text: {response.text[:500]}...") # Log just the start of the response
            
            # Handle non-200 response
            if response.status_code != 200:
                logger.error(f"Open-Meteo API error: {response.status_code}")
                logger.error(f"Response Body: {response.text}")
                return {
                    "error": f"Failed to fetch weather data: {response.status_code}",
                    "response_body": response.text[:200],  # Include just a portion
                    "request_params": params
                }
            
            # Parse JSON response
            try:
                data = response.json()
            except ValueError as json_err:
                logger.error(f"Failed to parse JSON response: {json_err}")
                logger.error(f"Response text: {response.text[:200]}")  # Log just a portion
                return {
                    "error": "Failed to parse weather data",
                    "response_body": response.text[:200]  # Include just a portion
                }
            
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

def process_weather_data(data: Dict[str, Any], units: str) -> Dict[str, Any]:
    """
    Process and transform raw weather data from Open-Meteo API
    
    Args:
        data: Raw API response from Open-Meteo
        units: Units system (metric or imperial)
        
    Returns:
        Processed weather data in a format expected by the frontend
    """
    try:
        # Extract the current, daily, and hourly data
        current_data = data.get('current', {})
        daily_data = data.get('daily', {})
        hourly_data = data.get('hourly', {})
        
        # Create standardized weather object
        weather = {
            "current": {
                # Map Open-Meteo field names to our expected field names
                "temperature": current_data.get('temperature_2m'),
                "relative_humidity": current_data.get('relative_humidity_2m'),
                "apparent_temperature": current_data.get('apparent_temperature'),
                "is_day": current_data.get('is_day'),
                "precipitation": current_data.get('precipitation'),
                "rain": current_data.get('rain'),
                "weather_code": current_data.get('weather_code'),
                "cloud_cover": current_data.get('cloud_cover'),
                "pressure_msl": current_data.get('pressure_msl'),
                "surface_pressure": current_data.get('surface_pressure'),
                "wind_speed_10m": current_data.get('wind_speed_10m'),
                "wind_direction_10m": current_data.get('wind_direction_10m'),
                "wind_gusts_10m": current_data.get('wind_gusts_10m'),
                # Include the original fields too for backward compatibility
                "temperature_2m": current_data.get('temperature_2m'),
                "relative_humidity_2m": current_data.get('relative_humidity_2m'),
                # Add weather description based on weather code
                "weather_description": get_weather_description(current_data.get('weather_code'))
            },
            "daily": daily_data,  # Keep as is
            "hourly": hourly_data  # Keep as is
        }
        
        # Return processed data
        return weather
    except Exception as e:
        logger.error(f"Error processing weather data: {str(e)}", exc_info=True)
        return {
            "error": f"Failed to process weather data: {str(e)}"
        }

def get_weather_description(weather_code: int) -> str:
    """
    Get human-readable weather description from WMO weather code
    
    Args:
        weather_code: WMO weather code from Open-Meteo
        
    Returns:
        Human-readable weather description
    """
    # WMO Weather interpretation codes (WW)
    # https://open-meteo.com/en/docs
    weather_descriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    }
    
    if weather_code is None:
        return "Unknown"
    
    return weather_descriptions.get(weather_code, "Unknown")

def clear_cache() -> None:
    """Clear the weather cache"""
    global _cache
    _cache = {}
    logger.info("Weather cache cleared")

def clean_expired_cache() -> int:
    """
    Remove expired items from the cache
    
    Returns:
        Number of items removed from cache
    """
    now = time.time()
    to_remove = []
    
    # Weather cache (expires after 1 hour)
    for key, item in _cache.items():
        if now - item.get('timestamp', 0) > 3600:  # 1 hour
            to_remove.append(key)
    
    for key in to_remove:
        del _cache[key]
    
    logger.info(f"Cleaned {len(to_remove)} expired items from weather cache")
    return len(to_remove)
