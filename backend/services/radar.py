# services/radar.py
import requests
import logging
import time
from typing import Dict, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)

# In-memory cache
_cache = {}

# RainViewer API URL
RAINVIEWER_API_URL = "https://api.rainviewer.com/public/weather-maps.json"

def get_radar_data() -> Dict[str, Any]:
    """
    Get radar data from RainViewer API
    
    Returns:
        Dictionary with radar data including past and forecast frames
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
        
        # Make API request
        logger.info("Fetching radar data from RainViewer API")
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
            logger.debug(f"Received radar data: {len(str(data))} bytes")
            
            # Cache the result
            _cache[cache_key] = {
                'data': data,
                'timestamp': time.time()
            }
            
            return data
        except ValueError as json_err:
            logger.error(f"Failed to parse radar JSON response: {json_err}")
            return {"error": "Failed to parse radar data"}
            
    except Exception as e:
        logger.error(f"Error getting radar data: {str(e)}", exc_info=True)
        return {"error": str(e)}

def get_radar_tile(host: str, path: str, x: int, y: int, z: int, color_scheme: int = 2, 
                  smooth: int = 1, snow: int = 1, size: int = 256, format: str = 'png') -> Optional[bytes]:
    """
    Get radar tile from RainViewer API
    
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
        Radar tile image data as bytes or None if error
    """
    logger.debug(f"get_radar_tile CALLED with: host={host}, path={path}, x={x}, y={y}, z={z}, color_scheme={color_scheme}")
    
    try:
        # Construct tile URL
        tile_url = f"{host}{path}/{size}/{z}/{x}/{y}/{color_scheme}/{smooth}_{snow}.{format}"
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
        response = requests.get(
            tile_url,
            timeout=10
        )
        
        # Handle non-200 response
        if response.status_code != 200:
            logger.error(f"Radar tile error: {response.status_code}")
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
