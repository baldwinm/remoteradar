# services/radar.py
import requests
import logging
import time
import json
from typing import Dict, Any, Optional

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
        
        # Log detailed response info
        logger.debug(f"RainViewer API Response Status: {response.status_code}")
        logger.debug(f"RainViewer API Response Headers: {response.headers}")
        
        # Handle non-200 response
        if response.status_code != 200:
            logger.error(f"RainViewer API error: {response.status_code}")
            return {"error": f"Failed to fetch radar data: {response.status_code}"}
        
        # Parse JSON response
        try:
            data = response.json()
            logger.debug(f"Received radar data: {len(str(data))} bytes")
            
            # Log a sample of the data structure
            logger.debug(f"Data structure sample: {json.dumps(data, indent=2)[:500]}...")
            
            # Validate the expected structure
            if not data.get('host'):
                logger.warning("Missing 'host' field in radar data")
                
            if not data.get('radar') or not data.get('radar', {}).get('past'):
                logger.warning("Missing 'radar.past' field in data structure")
            else:
                logger.debug(f"Found {len(data['radar']['past'])} past frames")
                
            if not data.get('radar') or not data.get('radar', {}).get('nowcast'):
                logger.warning("Missing 'radar.nowcast' field in data structure")
            else:
                logger.debug(f"Found {len(data['radar']['nowcast'])} forecast frames")
            
            # Cache the result
            _cache[cache_key] = {
                'data': data,
                'timestamp': time.time()
            }
            
            return data
        except ValueError as json_err:
            logger.error(f"Failed to parse radar JSON response: {json_err}")
            logger.error(f"Raw response content: {response.text[:500]}...")
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