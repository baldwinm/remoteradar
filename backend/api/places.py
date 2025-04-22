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
            
            # Enhanced city ID parsing that handles the new format (city_state_country)
            city_id_parts = city_id.split('_')
            
            # Determine search strategy based on city_id format
            if len(city_id_parts) >= 3 and city_id_parts[-1] == 'us':
                # Format is city_state_us (e.g., lafayette_co_us)
                city_name = '_'.join(city_id_parts[:-2]).replace('_', ' ')
                state_code = city_id_parts[-2]
                search_query = f"{city_name}, {state_code}, USA"
                current_app.logger.info(f"US city with state code detected. Search query: '{search_query}'")
            elif len(city_id_parts) == 2:
                # Format is city_country (e.g., paris_fr)
                city_name = city_id_parts[0].replace('_', ' ')
                country_code = city_id_parts[1]
                search_query = city_name
                current_app.logger.info(f"Standard city_country format detected. Search query: '{search_query}'")
            else:
                # Fallback for other formats
                city_name = city_id.split('_')[0].replace('_', ' ')
                search_query = city_name
                current_app.logger.info(f"Using simple city name for search: '{search_query}'")
            
            # Search for city
            current_app.logger.info(f"Searching for city with term: '{search_query}'")
            cities = search_city(search_query)
            
            city = None
            
            # First, try to find an exact match by ID
            for c in cities:
                current_app.logger.info(f"Comparing city ID: {c['id']} with requested ID: {city_id}")
                if c['id'] == city_id:
                    city = c
                    current_app.logger.info("MATCH FOUND!")
                    break
            
            # If no exact match, try to find the best match
            if not city and cities:
                # For US cities, try to match by state code
                if len(city_id_parts) >= 3 and city_id_parts[-1] == 'us':
                    state_code = city_id_parts[-2]
                    
                    # Look for city with the same state code
                    for c in cities:
                        if c['country_code'] == 'us' and c.get('state_code', '').lower() == state_code:
                            city = c
                            current_app.logger.info(f"Found US city by state code: {c['id']}")
                            break
                
                # If still no match, use the first result
                if not city:
                    city = cities[0]
                    current_app.logger.info(f"Using first result: {city['id']}")
            
            if not city:
                current_app.logger.error(f"City not found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_query}",
                    "success": False,
                    "search_term": search_query,
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
