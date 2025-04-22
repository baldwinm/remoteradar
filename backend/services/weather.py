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

# API Base URLs
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
RAINVIEWER_API_URL = "https://api.rainviewer.com/public/weather-maps.json"

def get_weather_data(lat: float, lng: float, units: str = 'imperial') -> Dict[str, Any]:
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
            'forecast_days': 12,
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
            
            # Get air quality and pollen data
            air_quality_data = get_air_quality_data(lat, lng)
            
            # Get weather alerts if available
            alerts_data = get_weather_alerts(lat, lng)
            
            # Process the API response
            processed_data = process_weather_data(data, air_quality_data, alerts_data, units)
            
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

def get_air_quality_data(lat: float, lng: float) -> Dict[str, Any]:
    """
    Get air quality data including pollen from Open-Meteo Air Quality API
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        Dictionary with air quality data
    """
    logger.debug(f"get_air_quality_data CALLED with: lat={lat}, lng={lng}")
    
    try:
        # Create cache key
        cache_key = f"air_quality_{lat}_{lng}"
        
        # Check cache (valid for 1 hour)
        if cache_key in _cache:
            cache_entry = _cache[cache_key]
            if time.time() - cache_entry.get('timestamp', 0) < 3600:
                logger.debug(f"Using cached air quality data for {cache_key}")
                return cache_entry.get('data', {})
        
        # Prepare API request parameters for air quality
        params = {
            'latitude': lat,
            'longitude': lng,
            'hourly': 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,european_aqi',
            'timezone': 'auto'
        }
        
        # Check if the location is in Europe to include pollen data
        # Rough check for Europe: longitude between -25 and 40, latitude between 35 and 70
        if -25 <= lng <= 40 and 35 <= lat <= 70:
            params['hourly'] += ',alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen'
        
        # Make API request
        response = requests.get(
            OPEN_METEO_AIR_QUALITY_URL,
            params=params,
            timeout=10
        )
        
        # Handle non-200 response
        if response.status_code != 200:
            logger.error(f"Air Quality API error: {response.status_code}")
            return {}
        
        # Parse JSON response
        try:
            data = response.json()
            
            # Cache the result
            _cache[cache_key] = {
                'data': data,
                'timestamp': time.time()
            }
            
            return data
        except ValueError as json_err:
            logger.error(f"Failed to parse air quality JSON response: {json_err}")
            return {}
            
    except Exception as e:
        logger.error(f"Error getting air quality data: {str(e)}", exc_info=True)
        return {}

def get_weather_alerts(lat: float, lng: float) -> List[Dict[str, Any]]:
    """
    Get weather alerts for a location
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        List of weather alerts
    """
    # Note: Open-Meteo doesn't currently offer a direct weather alerts API
    # This is a placeholder for future implementation or to use a different provider
    # For now, we'll create some sample alerts based on the forecast for demonstration
    
    # In a real implementation, this would make a call to a provider that offers weather alerts
    
    # Return empty list for now - will be populated with sample data in process_weather_data
    return []

def process_weather_data(data: Dict[str, Any], air_quality_data: Dict[str, Any], 
                         alerts_data: List[Dict[str, Any]], units: str) -> Dict[str, Any]:
    """
    Process and transform raw weather data from Open-Meteo API
    
    Args:
        data: Raw API response from Open-Meteo
        air_quality_data: Air quality data from Open-Meteo Air Quality API
        alerts_data: Weather alerts data
        units: Units system (metric or imperial)
        
    Returns:
        Processed weather data in a format expected by the frontend
    """
    try:
        # Extract the current, daily, and hourly data
        current_data = data.get('current', {})
        daily_data = data.get('daily', {})
        hourly_data = data.get('hourly', {})
        
        # Generate sample weather alerts based on precipitation probability
        alerts = []
        if daily_data and 'precipitation_probability_max' in daily_data:
            # For demonstration purposes, generate alerts based on high precipitation probability
            for i, precip_prob in enumerate(daily_data.get('precipitation_probability_max', [])):
                if precip_prob >= 70:  # 70% or higher chance of precipitation
                    date = daily_data.get('time', [])[i] if i < len(daily_data.get('time', [])) else 'upcoming day'
                    alerts.append({
                        'title': 'Heavy Precipitation Alert',
                        'description': f'High probability ({precip_prob}%) of significant precipitation on {date}.',
                        'severity': 'moderate',
                        'date': date
                    })
            
            # Add severe weather alert for extreme temperatures if applicable
            if 'temperature_2m_max' in daily_data:
                for i, temp in enumerate(daily_data.get('temperature_2m_max', [])):
                    if (units == 'imperial' and temp > 95) or (units == 'metric' and temp > 35):
                        date = daily_data.get('time', [])[i] if i < len(daily_data.get('time', [])) else 'upcoming day'
                        alerts.append({
                            'title': 'Extreme Heat Alert',
                            'description': f'Extreme heat expected on {date} with temperatures reaching {temp}°{units == "imperial" and "F" or "C"}.',
                            'severity': 'severe',
                            'date': date
                        })
        
        # Process air quality data
        air_quality = {}
        pollen = {}
        
        if air_quality_data and 'hourly' in air_quality_data:
            aq_hourly = air_quality_data.get('hourly', {})
            
            # Get current air quality data (first hour)
            air_quality = {
                'pm10': aq_hourly.get('pm10', [None])[0] if 'pm10' in aq_hourly and aq_hourly['pm10'] else None,
                'pm2_5': aq_hourly.get('pm2_5', [None])[0] if 'pm2_5' in aq_hourly and aq_hourly['pm2_5'] else None,
                'carbon_monoxide': aq_hourly.get('carbon_monoxide', [None])[0] if 'carbon_monoxide' in aq_hourly and aq_hourly['carbon_monoxide'] else None,
                'nitrogen_dioxide': aq_hourly.get('nitrogen_dioxide', [None])[0] if 'nitrogen_dioxide' in aq_hourly and aq_hourly['nitrogen_dioxide'] else None,
                'ozone': aq_hourly.get('ozone', [None])[0] if 'ozone' in aq_hourly and aq_hourly['ozone'] else None,
                'sulphur_dioxide': aq_hourly.get('sulphur_dioxide', [None])[0] if 'sulphur_dioxide' in aq_hourly and aq_hourly['sulphur_dioxide'] else None,
                'european_aqi': aq_hourly.get('european_aqi', [None])[0] if 'european_aqi' in aq_hourly and aq_hourly['european_aqi'] else None,
            }
            
            # Get pollen data if available
            pollen_types = ['alder_pollen', 'birch_pollen', 'grass_pollen', 
                          'mugwort_pollen', 'olive_pollen', 'ragweed_pollen']
            
            for pollen_type in pollen_types:
                if pollen_type in aq_hourly and aq_hourly[pollen_type]:
                    # Get daily max values for pollen
                    daily_values = []
                    for i in range(0, len(aq_hourly[pollen_type]), 24):
                        daily_max = max([x for x in aq_hourly[pollen_type][i:i+24] if x is not None], default=None)
                        daily_values.append(daily_max)
                    
                    pollen[pollen_type] = daily_values
        
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
            "hourly": hourly_data,  # Keep as is
            "air_quality": air_quality,
            "pollen": pollen,
            "alerts": alerts
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

def get_radar_data() -> Dict[str, Any]:
    """
    Get radar data from RainViewer API
    
    Returns:
        Dictionary with radar data including frames for past and forecast
    """
    logger.debug("get_radar_data CALLED")
    
    try:
        # Create cache key
        cache_key = "radar_data"
        
        # Check cache (valid for 10 minutes for radar data)
        if cache_key in _cache:
            cache_entry = _cache[cache_key]
            if time.time() - cache_entry.get('timestamp', 0) < 600:  # 10 minutes
                logger.debug("Using cached radar data")
                return cache_entry.get('data', {})
        
        # Make API request
        response = requests.get(
            RAINVIEWER_API_URL,
            timeout=10
        )
        
        # Handle non-200 response
        if response.status_code != 200:
            logger.error(f"RainViewer API error: {response.status_code}")
            return {"error": f"Failed to fetch radar data: {response.status_code}"}
        
        # Parse JSON response
        try:
            data = response.json()
            
            # Process data
            processed_data = format_radar_data(data)
            
            # Cache the result
            _cache[cache_key] = {
                'data': processed_data,
                'timestamp': time.time()
            }
            
            return processed_data
        except ValueError as json_err:
            logger.error(f"Failed to parse radar JSON response: {json_err}")
            return {"error": "Failed to parse radar data"}
            
    except Exception as e:
        logger.error(f"Error getting radar data: {str(e)}", exc_info=True)
        return {"error": str(e)}

def format_radar_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format RainViewer API data into a more usable structure
    
    Args:
        data: Raw API data from RainViewer
        
    Returns:
        Formatted radar data
    """
    if not data:
        return {}
        
    try:
        # Extract host from API response
        host = data.get('host', '')
        
        # Extract past frames
        past_frames = data.get('radar', {}).get('past', [])
        
        # Extract forecast frames
        forecast_frames = data.get('radar', {}).get('nowcast', [])
        
        # Create frame objects with proper metadata
        formatted_past = []
        for frame in past_frames:
            formatted_past.append({
                'time': frame.get('time', 0),
                'path': frame.get('path', ''),
                'timestamp': datetime.fromtimestamp(frame.get('time', 0)).strftime('%Y-%m-%d %H:%M:%S')
            })
            
        formatted_forecast = []
        for frame in forecast_frames:
            formatted_forecast.append({
                'time': frame.get('time', 0),
                'path': frame.get('path', ''),
                'timestamp': datetime.fromtimestamp(frame.get('time', 0)).strftime('%Y-%m-%d %H:%M:%S')
            })
            
        # Return formatted data structure
        return {
            'host': host,
            'radar': {
                'past': formatted_past,
                'forecast': formatted_forecast
            },
            'options': {
                'color_schemes': [
                    {'name': 'Original', 'value': 0},
                    {'name': 'Universal Blue', 'value': 1},
                    {'name': 'TITAN', 'value': 2},
                    {'name': 'The Weather Channel', 'value': 3},
                    {'name': 'Meteored', 'value': 4},
                    {'name': 'NEXRAD Level-III', 'value': 5},
                    {'name': 'Rainbow @ SELEX-SI', 'value': 6},
                    {'name': 'Dark Sky', 'value': 7},
                    {'name': 'Skyview', 'value': 8}
                ]
            }
        }
    except Exception as e:
        logger.error(f"Error formatting radar data: {str(e)}", exc_info=True)
        return {}

def get_radar_tile_url(host: str, path: str, x: int, y: int, z: int, color_scheme: int = 2, 
                      smooth: int = 1, snow: int = 1, size: int = 256, format: str = 'webp') -> str:
    """
    Generate URL for radar tile
    
    Args:
        host: API host from RainViewer response
        path: Path for the specific frame
        x: Tile X coordinate
        y: Tile Y coordinate
        z: Zoom level
        color_scheme: Color scheme ID (0-8)
        smooth: Smooth data (0 or 1)
        snow: Show snow colors (0 or 1)
        size: Tile size (256 or 512)
        format: Image format (webp or png)
        
    Returns:
        URL for radar tile
    """
    return f"{host}{path}/{size}/{z}/{x}/{y}/{color_scheme}/{smooth}_{snow}.{format}"

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
        if key.startswith('radar_') and now - item.get('timestamp', 0) > 600:  # 10 minutes for radar data
            to_remove.append(key)
        elif now - item.get('timestamp', 0) > 3600:  # 1 hour for other data
            to_remove.append(key)
    
    for key in to_remove:
        del _cache[key]
    
    logger.info(f"Cleaned {len(to_remove)} expired items from weather cache")
    return len(to_remove)
