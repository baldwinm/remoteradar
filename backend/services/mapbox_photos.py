# services/mapbox_photos.py
import os
import time
import random
import logging
from typing import Dict, Any, Optional

def get_city_map_image(
    city: str, 
    lat: float, 
    lng: float, 
    api_key: str = None,
    state: str = '',
    country: str = ''
) -> Dict[str, Any]:
    """
    Get a stylized map image for a city location using Mapbox Static Images API
    
    Args:
        city: City name
        lat: Latitude
        lng: Longitude
        api_key: Mapbox API key (uses env var if not provided)
        state: Optional state name
        country: Optional country name
    
    Returns:
        Dict with image URLs and metadata
    """
    # Use environment variable if no API key provided
    mapbox_api_key = api_key or os.getenv('MAPBOX_API_KEY', '')
    
    if not mapbox_api_key:
        raise ValueError("Mapbox API key not configured. Set MAPBOX_API_KEY environment variable.")
    
    try:
        # Different styles to add variety
        styles = [
            "streets-v11",     # Default street map
            "light-v10",       # Light, minimalist style
            "outdoors-v11",    # Terrain and outdoors style
            "satellite-v9"     # Satellite imagery
        ]
        
        # Randomly select a style for variety
        style = random.choice(styles)
        
        # Adjust zoom based on city size (could be enhanced with more logic)
        zoom = 12  # City-level zoom
        width = 800
        height = 400
        
        # Construct full location name for attribution
        location_name = city
        if state:
            location_name += f", {state}"
        if country:
            location_name += f", {country}"
        
        # Generate Mapbox Static Image URL
        # Add attribution=false to remove any third-party attributions
        url = f"https://api.mapbox.com/styles/v1/mapbox/{style}/static/{lng},{lat},{zoom}/{width}x{height}?access_token={mapbox_api_key}&attribution=false"
        
        return {
            "success": True,
            "url": url,
            "small_url": url.replace(f"{width}x{height}", "400x200"),
            "thumb_url": url.replace(f"{width}x{height}", "200x100"),
            "attribution": {
                "name": "Mapbox",
                "username": "mapbox",
                "link": "https://www.mapbox.com/"
            },
            "is_map": True,
            "style": style,
            "timestamp": time.time(),
            "location": {
                "city": city,
                "state": state,
                "country": country,
                "coordinates": {
                    "lat": lat,
                    "lng": lng
                }
            }
        }
    
    except Exception as e:
        logging.error(f"Error generating Mapbox static image: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "location": {
                "city": city,
                "state": state,
                "country": country,
                "coordinates": {
                    "lat": lat,
                    "lng": lng
                }
            }
        }
