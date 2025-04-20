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
            # First, find city info using the same more robust approach from get_places
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
                # Try alternative matching approaches
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
                    "city_id": city_id,
                    "average_price": 0,
                    "accommodations": []
                }), 404
            
            # Log the city data we found
            current_app.logger.info(f"Found city for accommodation: {city['name']} (ID: {city['id']})")
            
            # Get accommodation data
            api_key = os.getenv('AIRBNB_API_KEY', '')
            api_url = "https://airbnb19.p.rapidapi.com/api/v1/searchPropertyByLocationV2"
            
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
