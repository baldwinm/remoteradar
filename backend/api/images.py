# api/images.py
import os
import sys
import time
import logging
from flask import Blueprint, jsonify, request, make_response, current_app
from flask_cors import cross_origin

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.mapbox_photos import get_city_map_image
from services.opencage import search_city

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

def register_images_routes(app, limiter):
    """Register all routes related to city images"""
    
    @app.route('/api/city-image', methods=['GET'])
    @limiter.limit("20 per minute")
    @cross_origin(
        origins=['https://remoteradar.net', 'http://localhost:3000', 'https://www.remoteradar.net'],
        supports_credentials=True
    )
    def get_city_image():
        """Get a city map image using Mapbox Static Images API"""
        # Extract parameters with more robust error handling
        city = request.args.get('city', '').strip()
        country = request.args.get('country', '').strip()
        state = request.args.get('state', '').strip()
        
        # Get coordinates if provided, with improved error handling
        try:
            lat = float(request.args.get('lat', '')) if request.args.get('lat') else None
            lng = float(request.args.get('lng', '')) if request.args.get('lng') else None
        except (ValueError, TypeError):
            lat, lng = None, None
            current_app.logger.warning("Invalid coordinates provided, will attempt to find coordinates")
        
        # Comprehensive logging of request details
        log_message = f"City map image request received: city='{city}', state='{state}', country='{country}'"
        if lat is not None and lng is not None:
            log_message += f", coordinates=({lat}, {lng})"
        current_app.logger.info(log_message)
        
        # Validate city parameter
        if not city:
            current_app.logger.warning("City map image request missing city parameter")
            return jsonify({
                "error": "City parameter is required",
                "success": False
            }), 400
        
        try:
            # If we don't have coordinates but have a city name, try to get coordinates
            if (lat is None or lng is None) and city:
                # Create search query with available information
                search_query = city
                if state:
                    search_query += f", {state}"
                if country:
                    search_query += f", {country}"
                
                # Search for city to get coordinates
                try:
                    city_results = search_city(search_query)
                    if city_results and len(city_results) > 0:
                        # Use the first result's coordinates
                        city_info = city_results[0]
                        lat = city_info.get('lat')
                        lng = city_info.get('lng')
                        
                        # If we found a more specific state/country, use it
                        if not state and 'state' in city_info:
                            state = city_info.get('state', '')
                        if not country and 'country' in city_info:
                            country = city_info.get('country', '')
                            
                        current_app.logger.info(
                            f"Found coordinates for {city}: ({lat}, {lng}), "
                            f"state: {state}, country: {country}"
                        )
                except Exception as e:
                    current_app.logger.warning(f"Error finding city coordinates: {str(e)}")
                    # Continue without coordinates
            
            # Validate we have coordinates
            if lat is None or lng is None:
                raise ValueError(f"Could not find coordinates for {city}")
            
            # Use the Mapbox API to get a map image
            mapbox_api_key = os.getenv('MAPBOX_API_KEY', '')
            
            # Image retrieval with Mapbox
            image_data = get_city_map_image(
                city=city,
                state=state,
                country=country,
                lat=lat,
                lng=lng,
                api_key=mapbox_api_key
            )
            
            current_app.logger.info(f"Successfully retrieved Mapbox map image for {city}")
            
            # Create a response object for better control
            response = make_response(jsonify(image_data))
            
            # Add CORS headers explicitly
            response.headers.add('Access-Control-Allow-Origin', 'https://remoteradar.net')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            
            # Add caching headers
            return add_cache_headers(response, max_age=86400)  # Cache for 1 day
        
        except Exception as e:
            current_app.logger.error(f"Error fetching city map image: {str(e)}", exc_info=True)
            
            # Fallback to a simple city placeholder with more detailed error information
            try:
                # Generate a placeholder with city name and additional context
                placeholder_data = {
                    "success": True,
                    "url": f"https://via.placeholder.com/800x400/0F2E4C/FFFFFF?text={city.replace(' ', '+')}",
                    "small_url": f"https://via.placeholder.com/400x200/0F2E4C/FFFFFF?text={city.replace(' ', '+')}",
                    "thumb_url": f"https://via.placeholder.com/200x100/0F2E4C/FFFFFF?text={city.replace(' ', '+')}",
                    "attribution": {
                        "name": "Placeholder",
                        "username": "placeholder",
                        "link": "https://placeholder.com/"
                    },
                    "is_placeholder": True,
                    "error": str(e),
                    "context": {
                        "city": city,
                        "state": state,
                        "country": country,
                        "coordinates": {
                            "lat": lat,
                            "lng": lng
                        }
                    },
                    "timestamp": time.time()
                }
                
                # Create a response object for better control
                response = make_response(jsonify(placeholder_data))
                
                # Add CORS headers explicitly
                response.headers.add('Access-Control-Allow-Origin', 'https://remoteradar.net')
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                
                return add_cache_headers(response, max_age=3600)  # Cache for 1 hour only
            except Exception as fallback_error:
                # If even the placeholder fails, return a more comprehensive error
                current_app.logger.critical(f"Complete fallback error: {str(fallback_error)}")
                return jsonify({
                    "error": "Multiple errors occurred while fetching city map image",
                    "original_error": str(e),
                    "fallback_error": str(fallback_error),
                    "success": False
                }), 500
