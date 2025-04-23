# services/radar.py
import requests
import logging
import time
import json
from typing import Dict, Any, Optional
import os

# Initialize logger
logger = logging.getLogger(__name__)

# Set logging level to DEBUG for development
logger.setLevel(logging.DEBUG)

# Add a console handler if not present
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# In-memory cache
_cache = {}

# Get API key from environment (or set it directly for testing)
OWM_API_KEY = os.environ.get('OWM_API_KEY', 'YOUR_OPENWEATHERMAP_API_KEY')

def get_radar_data() -> Dict[str, Any]:
    """
    Get radar data from OpenWeatherMap API
    
    Returns:
        Dictionary with radar data including available layers
    """
    logger.debug("get_radar_data CALLED")
    
    try:
        # Create cache key
        cache_key = "radar_data"
        
        # Check cache (valid for 5 minutes for radar data)
        if cache_key in _cache:
            cache_entry = _cache[cache_key]
            if time.time() - cache_entry.get('timestamp', 0) < 300:  # 5 minutes
                logger.debug("Using cached radar data")
                return cache_entry.get('data', {})
        
        # Create formatted data structure similar to RainViewer for compatibility
        # This will be used by the frontend
        data = {
            "host": "https://tile.openweathermap.org",
            "radar": {
                "past": [
                    {
                        "time": int(time.time()),
                        "path": "/map/precipitation_new"
                    }
                ]
            },
            "options": {
                "color_schemes": [
                    {"name": "Default", "value": 0},
                    {"name": "Universal Blue", "value": 1},
                    {"name": "TITAN", "value": 2}
                ]
            }
        }
        
        logger.debug(f"Generated OpenWeatherMap radar data structure")
        
        # Cache the result
        _cache[cache_key] = {
            'data': data,
            'timestamp': time.time()
        }
        
        return data
            
    except Exception as e:
        logger.error(f"Error getting radar data: {str(e)}", exc_info=True)
        return {"error": str(e)}

def get_radar_tile(host: str, path: str, x: int, y: int, z: int, color_scheme: int = 0, 
                  smooth: int = 1, snow: int = 1, size: int = 256, format: str = 'png') -> Optional[bytes]:
    """
    Get radar tile from OpenWeatherMap API
    
    Args:
        host: API host (should be 'https://tile.openweathermap.org')
        path: Path for the layer ('/map/precipitation_new', '/map/clouds_new', etc.)
        x: Tile X coordinate
        y: Tile Y coordinate
        z: Zoom level
        color_scheme: Ignored for OpenWeatherMap (kept for compatibility)
        smooth: Ignored for OpenWeatherMap (kept for compatibility)
        snow: Ignored for OpenWeatherMap (kept for compatibility)
        size: Ignored for OpenWeatherMap (kept for compatibility)
        format: Ignored for OpenWeatherMap (kept for compatibility)
        
    Returns:
        Radar tile image data as bytes or None if error
    """
    logger.debug(f"get_radar_tile CALLED with: host={host}, path={path}, x={x}, y={y}, z={z}")
    
    try:
        # Construct tile URL for OpenWeatherMap
        tile_url = f"{host}{path}/{z}/{x}/{y}.png?appid={OWM_API_KEY}"
        logger.debug(f"Tile URL: {tile_url}")
        
        # Create cache key
        cache_key = f"radar_tile_{tile_url}"
        
        # Check cache (valid for 5 minutes)
        if cache_key in _cache:
            cache_entry = _cache[cache_key]
            if time.time() - cache_entry.get('timestamp', 0) < 300:  # 5 minutes
                logger.debug("Using cached radar tile")
                return cache_entry.get('data')
        
        # Make API request
        logger.debug(f"Requesting tile from: {tile_url}")
        response = requests.get(
            tile_url,
            timeout=10
        )
        
        # Log response details for debugging
        logger.debug(f"Tile response status: {response.status_code}")
        logger.debug(f"Tile response content type: {response.headers.get('Content-Type')}")
        logger.debug(f"Tile response size: {len(response.content)} bytes")
        
        # Handle non-200 response
        if response.status_code != 200:
            logger.error(f"Radar tile error: {response.status_code}")
            logger.error(f"Response headers: {response.headers}")
            
            # Try to get response content for error analysis
            try:
                error_content = response.text[:200]
                logger.error(f"Error response content: {error_content}")
            except:
                logger.error("Could not read error response content")
                
            return None
        
        # Cache the result
        _cache[cache_key] = {
            'data': response.content,
            'timestamp': time.time()
        }
        
        return response.content
            
    except Exception as e:
        logger.error(f"Error getting radar tile: {str(e)}", exc_info=True)
        return None

def clear_cache() -> None:
    """Clear the radar cache"""
    global _cache
    _cache = {}
    logger.info("Radar cache cleared")
