# api/weather.py
from flask import Blueprint, jsonify, request, make_response, current_app
import logging
import os
import sys
import json

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
        
        # Enhanced logging with more context
        current_app.logger.info(f"WEATHER ENDPOINT CALLED")
        current_app.logger.info(f"Full Request Details:")
        current_app.logger.info(f"City ID: {city_id}")
        current_app.logger.info(f"Units: {units}")
        current_app.logger.info(f"Full Request Args: {dict(request.args)}")
        
        try:
            # First, find city info
            search_term = city_id.split('_')[0].replace('_', ' ')
            current_app.logger.info(f"Derived search term: '{search_term}'")
            
            # Perform city search
            cities = search_city(search_term)
            
            # Log all found cities
            current_app.logger.info(f"Cities found: {json.dumps(cities, indent=2)}")
            
            city = None
            # Try exact match first
            for c in cities:
                if c['id'] == city_id:
                    city = c
                    current_app.logger.info(f"Found exact match: {json.dumps(c, indent=2)}")
                    break
            
            if not city:
                # Try alternative matching approaches
                current_app.logger.info("No exact match found, attempting alternative matching...")
                parts = city_id.split('_')
                country_code = parts[-1] if len(parts) > 1 else None
                
                # Try full city name search
                full_city_name = '_'.join(parts[:-1]).replace('_', ' ') if country_code else city_id.replace('_', ' ')
                current_app.logger.info(f"Attempting match with full city name: '{full_city_name}'")
                
                cities_retry = search_city(full_city_name)
                
                # Log retry search results
                current_app.logger.info(f"Alternative search results: {json.dumps(cities_retry, indent=2)}")
                
                if cities_retry and country_code:
                    # Look for country code match
                    for c in cities_retry:
                        c_country_code = c['id'].split('_')[-1] if '_' in c['id'] else None
                        current_app.logger.info(f"Checking city: {c['id']}, Country Code: {c_country_code}")
                        if c_country_code == country_code:
                            city = c
                            current_app.logger.info(f"Found match with country code: {c['id']}")
                            break
                
                # If still not found, take the first result
                if not city and cities_retry:
                    city = cities_retry[0]
                    current_app.logger.info(f"Taking first result as fallback: {json.dumps(city, indent=2)}")
            
            if not city:
                current_app.logger.error(f"No city found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_term}",
                    "success": False,
                    "city_id": city_id,
                    "search_details": {
                        "original_search_term": search_term,
                        "full_city_name": full_city_name if 'full_city_name' in locals() else None
                    }
                }), 404
            
            # Extensive logging of found city details
            current_app.logger.info("CITY DETAILS:")
            current_app.logger.info(f"Name: {city.get('name', 'N/A')}")
            current_app.logger.info(f"ID: {city.get('id', 'N/A')}")
            current_app.logger.info(f"Latitude: {city.get('lat', 'N/A')}")
            current_app.logger.info(f"Longitude: {city.get('lng', 'N/A')}")
            current_app.logger.info(f"Country: {city.get('country', 'N/A')}")
            current_app.logger.info(f"State: {city.get('state', 'N/A')}")
            
            # Validate coordinates before weather data fetch
            lat = city.get('lat')
            lng = city.get('lng')
            
            if lat is None or lng is None:
                current_app.logger.error(f"Invalid coordinates: lat={lat}, lng={lng}")
                return jsonify({
                    "error": "Invalid coordinates for city",
                    "success": False,
                    "city_details": city
                }), 400
            
            # Get weather data
            weather_data = get_weather_data(
                lat=lat,
                lng=lng,
                units=units
            )
            
            # Build response
            response_data = {
                "success": True,
                "city_id": city['id'],
                "city_name": city['name'],
                "country": city.get('country', ''),
                "state": city.get('state', ''),
                "weather": weather_data,
                "coordinates": {
                    "lat": lat,
                    "lng": lng
                }
            }
            
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=1800)  # Cache for 30 minutes
        
        except Exception as e:
            current_app.logger.error(f"Comprehensive weather error: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "city_id": city_id,
                "error_details": {
                    "exception_type": type(e).__name__,
                    "full_trace": str(e)
                }
            }), 500
