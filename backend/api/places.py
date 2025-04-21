# api/places.py
from flask import Blueprint, jsonify, request, make_response, current_app
import logging
import time
import os
import sys

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.google_places import get_places_data, get_place_details
from services.opencage import search_city

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

def register_places_routes(app, limiter):
    """Register all routes related to places (coffee shops, coworking spaces, etc.)"""
    
    @app.route('/api/places/<city_id>', methods=['GET'])
    @limiter.limit("5 per minute")
    def get_places(city_id):
        """Get coffee shops, coworking spaces, and restaurants for a city"""
        try:
            current_app.logger.info(f"API ENDPOINT: /api/places/{city_id}")
            
            # First, find city info
            search_term = city_id.split('_')[0].replace('_', ' ')
            current_app.logger.info(f"Searching for city with term: '{search_term}' derived from city_id: '{city_id}'")
            cities = search_city(search_term)
            
            city = None
            for c in cities:
                current_app.logger.info(f"Comparing city ID: {c['id']} with requested ID: {city_id}")
                if c['id'] == city_id:
                    city = c
                    current_app.logger.info("MATCH FOUND!")
                    break
            
            if not city:
                # Try a more flexible search approach
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
                        "search_term": search_term,
                        "city_id": city_id
                    }), 404
            
            # Log the city data we found
            current_app.logger.info(f"Found city: {city['name']} (ID: {city['id']})")
            current_app.logger.info(f"Location: lat={city['lat']}, lng={city['lng']}")
            
            # Get places data
            places_data = get_places_data(city_id, city['name'], city['lat'], city['lng'])
            
            # Filter by type if specified
            place_type = request.args.get('type', 'all')
            if place_type != 'all' and 'places' in places_data:
                places_data['places'] = [p for p in places_data['places'] if p['type'] == place_type]
                
            response_data = {"success": True, **places_data}
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=3600)  # Cache for 1 hour
        
        except Exception as e:
            current_app.logger.error(f"Places error: {str(e)}", exc_info=True)
            import traceback
            traceback.print_exc()
            
            return jsonify({
                "error": str(e),
                "success": False,
                "city_id": city_id,
                "places": []
            }), 500

    @app.route('/api/place-details/<place_id>', methods=['GET'])
    @limiter.limit("15 per minute")
    def get_single_place_details(place_id):
        """Get detailed information for a single place"""
        try:
            current_app.logger.info(f"API ENDPOINT: /api/place-details/{place_id}")
            
            details = get_place_details(place_id)
            
            if not details:
                current_app.logger.warning(f"Place details not found for ID: {place_id}")
                return jsonify({
                    "error": "Place details not found",
                    "success": False,
                    "place_id": place_id
                }), 404
                
            response_data = {
                "success": True,
                "place_id": place_id,
                "details": details
            }
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=86400)  # Cache for 1 day
            
        except Exception as e:
            current_app.logger.error(f"Place details error: {str(e)}", exc_info=True)
            return jsonify({
                "error": str(e),
                "success": False,
                "place_id": place_id
            }), 500
