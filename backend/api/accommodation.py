# api/accommodation.py
from flask import Blueprint, jsonify, request, make_response, current_app
import logging
import os
import sys
import traceback

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.airbnb import fetch_accommodations
from services.opencage import search_city

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

def register_accommodation_routes(app, limiter):
    """Register all routes related to accommodations"""
    
    @app.route('/api/accommodation/<city_id>', methods=['GET'])
    @limiter.limit("5 per minute")
    def get_accommodation(city_id):
        """Get Airbnb pricing information for a city"""
        # Parse occupants parameter with error handling
        try:
            occupants = int(request.args.get('occupants', 1))
        except ValueError:
            occupants = 1
        
        current_app.logger.info(f"API ENDPOINT: /api/accommodation/{city_id}?occupants={occupants}")
        
        try:
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
            
            # Search for city using the constructed query
            current_app.logger.info(f"Searching for city with term: '{search_query}'")
            cities = search_city(search_query)
            
            city = None
            
            # First, try to find an exact match by ID
            for c in cities:
                if c['id'] == city_id:
                    city = c
                    current_app.logger.info(f"Found exact match: {c['id']}")
                    break
            
            # If no exact match, try to find the best match
            if not city and cities:
                # For US cities with state code
                if len(city_id_parts) >= 3 and city_id_parts[-1] == 'us':
                    state_code = city_id_parts[-2]
                    
                    # Look for city with the same state code
                    for c in cities:
                        if c['country_code'] == 'us' and c.get('state_code', '').lower() == state_code:
                            city = c
                            current_app.logger.info(f"Found US city by state code: {c['id']}")
                            break
                
                # If still no match, use the first result as fallback
                if not city:
                    city = cities[0]
                    current_app.logger.info(f"Using first result as fallback: {city['id']}")
            
            if not city:
                current_app.logger.error(f"City not found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_query}",
                    "success": False,
                    "city_id": city_id,
                    "average_price": 0,
                    "accommodations": []
                }), 404
            
            # Log the city data we found
            current_app.logger.info(f"Found city for accommodation: {city['name']} (ID: {city['id']})")
            
            # Get accommodation data
            api_key = os.getenv('AIRBNB_API_KEY', '')
            api_url = "https://airbnb19.p.rapidapi.com/api/v2/searchPropertyByLocation"
            
            accommodation_data = fetch_accommodations(
                city_data=city,
                api_key=api_key,
                api_url=api_url,
                occupants=occupants
            )
            
            response_data = {"success": True, **accommodation_data}
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=1800)  # Cache for 30 minutes
        
        except Exception as e:
            current_app.logger.error(f"Accommodation error: {str(e)}", exc_info=True)
            traceback.print_exc()
            
            return jsonify({
                "error": str(e),
                "success": False,
                "city_id": city_id,
                "average_price": 0,
                "accommodations": []
            }), 500
