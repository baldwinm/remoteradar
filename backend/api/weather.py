# api/weather.py
from flask import Blueprint, jsonify, request, make_response, current_app
import logging
import os
import sys

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.weather import get_weather_data
from services.opencage import search_city

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

def register_weather_routes(app, limiter):
    """Register all routes related to weather"""
    
    @app.route('/api/weather/<city_id>', methods=['GET'])
    @limiter.limit("10 per minute")
    def get_weather(city_id):
        """Get weather information for a city"""
        # Parse units parameter
        units = request.args.get('units', 'metric')
        
        current_app.logger.info(f"API ENDPOINT: /api/weather/{city_id}?units={units}")
        
        try:
            # First, find city info
            search_term = city_id.split('_')[0].replace('_', ' ')
            current_app.logger.info(f"Searching for city with term: '{search_term}' derived from city_id: '{city_id}'")
            cities = search_city(search_term)
            
            city = None
            # Try exact match first
            for c in cities:
                if c['id'] == city_id:
                    city = c
                    current_app.logger.info(f"Found exact match: {c['id']}")
                    break
            
            if not city:
                # Try alternative matching approaches (same logic as in other endpoints)
                current_app.logger.info("City not found with exact ID match, trying looser matching...")
                parts = city_id.split('_')
                country_code = parts[-1] if len(parts) > 1 else None
                
                # Try full city name search
                full_city_name = '_'.join(parts[:-1]).replace('_', ' ') if country_code else city_id.replace('_', ' ')
                current_app.logger.info(f"Searching with full city name: '{full_city_name}'")
                
                cities_retry = search_city(full_city_name)
                
                if cities_retry and country_code:
                    # Look for country code match
                    for c in cities_retry:
                        c_country_code = c['id'].split('_')[-1]
                        if c_country_code == country_code:
                            city = c
                            current_app.logger.info(f"Found match with country code: {c['id']}")
                            break
                
                # If still not found, take the first result
                if not city and cities_retry:
                    city = cities_retry[0]
                    current_app.logger.info(f"Taking first result as fallback: {city['id']}")
            
            if not city:
                current_app.logger.error(f"City not found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_term}",
                    "success": False,
                    "city_id": city_id
                }), 404
            
            # Log the city data we found
            current_app.logger.info(f"Found city for weather: {city['name']} (ID: {city['id']})")
            
            # Get weather data
            weather_data = get_weather_data(
                lat=city['lat'],
                lng=city['lng'],
                units=units
            )
            
            # Build response
            response_data = {
                "success": True,
                "city_id": city['id'],
                "city_name": city['name'],
                "country": city.get('country', ''),
                "state": city.get('state', ''),
                "weather": weather_data
            }
            
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=1800)  # Cache for 30 minutes
        
        except Exception as e:
            current_app.logger.error(f"Weather error: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "city_id": city_id
            }), 500