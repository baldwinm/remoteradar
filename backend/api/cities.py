# api/cities.py
from flask import Blueprint, jsonify, request, make_response, current_app
import logging
import json
import os
import sys

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.opencage import search_city

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

def register_cities_routes(app, limiter):
    """Register all routes related to cities"""
    
    @app.route('/api/cities', methods=['GET'])
    @limiter.limit("15 per minute")
    def get_cities():
        """Search for cities"""
        search_query = request.args.get('q', '')
        
        if not search_query:
            return jsonify([])
        
        try:
            current_app.logger.info(f"API ENDPOINT: /api/cities?q={search_query}")
            cities = search_city(search_query)
            
            # Extract country code from city ID for special handling
            # This is a safer approach since we standardized the city ID format
            for city in cities:
                if '_' in city.get('id', ''):
                    # Extract country code from ID (format: cityname_countrycode)
                    city_id_parts = city['id'].split('_')
                    if len(city_id_parts) > 1:
                        # Add country_code if needed by frontend
                        city['country_code'] = city_id_parts[-1]
                else:
                    # Fallback
                    city['country_code'] = 'xx'
                    
                # For US cities, extract state code if needed
                if city.get('country_code') == 'us' and city.get('state'):
                    # Extract first 2 letters as state code if not already present
                    if not city.get('state_code'):
                        state_words = city['state'].split()
                        if len(state_words) == 2 and len(state_words[1]) == 2:
                            # For "New Mexico" -> "NM" format
                            city['state_code'] = state_words[1].upper()
                        else:
                            # Take first 2 chars of state as fallback
                            city['state_code'] = city['state'][:2].upper()
            
            # For debugging, print full details of found cities
            current_app.logger.info(f"Found {len(cities)} cities for search query: '{search_query}'")
            for city in cities:
                current_app.logger.info(f"  - City details: {json.dumps(city)}")
            
            response = make_response(jsonify(cities))
            return add_cache_headers(response, max_age=86400)  # Cache for 1 day
        except Exception as e:
            current_app.logger.error(f"City search error: {str(e)}", exc_info=True)
            return jsonify({"error": str(e), "success": False}), 500
