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
            
            # For debugging, print full details of found cities
            current_app.logger.info(f"Found {len(cities)} cities for search query: '{search_query}'")
            for city in cities:
                current_app.logger.info(f"  - City details: {json.dumps(city)}")
                
                # Log the city ID format for clarity
                current_app.logger.info(f"  - City ID format: {city['id']}")
                
                # Ensure state_code is included for US cities
                if city['country_code'] == 'us' and city.get('state_code'):
                    current_app.logger.info(f"  - US city with state code: {city['state_code']}")
            
            response = make_response(jsonify(cities))
            return add_cache_headers(response, max_age=86400)  # Cache for 1 day
        except Exception as e:
            current_app.logger.error(f"City search error: {str(e)}", exc_info=True)
            return jsonify({"error": str(e), "success": False}), 500
