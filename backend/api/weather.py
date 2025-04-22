# api/weather.py
from flask import Blueprint, jsonify, request, make_response, current_app
import logging
import os
import sys
import json

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.weather import get_weather_data, get_radar_data, get_radar_tile_url

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
        # Parse units parameter with validation
        units = request.args.get('units', 'imperial')
        if units not in ['metric', 'imperial']:
            units = 'imperial'  # Default to imperial for invalid values
        
        # Check if coordinates are directly provided in the query parameters
        # This is a new direct approach that bypasses city lookup if coordinates are provided
        direct_lat = request.args.get('lat')
        direct_lng = request.args.get('lng')
        
        # Enhanced logging with more context
        current_app.logger.info(f"WEATHER ENDPOINT CALLED")
        current_app.logger.info(f"Full Request Details:")
        current_app.logger.info(f"City ID: {city_id}")
        current_app.logger.info(f"Units: {units}")
        current_app.logger.info(f"Direct coordinates: lat={direct_lat}, lng={direct_lng}")
        current_app.logger.info(f"Full Request Args: {dict(request.args)}")
        current_app.logger.info(f"Remote Address: {request.remote_addr}")
        current_app.logger.info(f"User Agent: {request.user_agent}")
        
        try:
            # Validate city_id
            if not city_id or len(city_id) < 3:
                current_app.logger.error(f"Invalid city_id: {city_id}")
                return jsonify({
                    "error": "Invalid city ID",
                    "success": False,
                    "city_id": city_id
                }), 400
            
            # If direct coordinates are provided, use them directly
            if direct_lat is not None and direct_lng is not None:
                try:
                    # Convert to float and validate
                    lat = float(direct_lat)
                    lng = float(direct_lng)
                    
                    if abs(lat) > 90 or abs(lng) > 180:
                        current_app.logger.error(f"Direct coordinates out of valid range: lat={lat}, lng={lng}")
                        return jsonify({
                            "error": f"Coordinates out of valid range: lat={lat}, lng={lng}",
                            "success": False,
                        }), 400
                    
                    # If we have valid coordinates, use them directly for weather data
                    current_app.logger.info(f"Using direct coordinates: lat={lat}, lng={lng}")
                    
                    # Get weather data
                    weather_data = get_weather_data(
                        lat=lat,
                        lng=lng,
                        units=units
                    )
                    
                    # Check for error in weather data
                    if 'error' in weather_data:
                        current_app.logger.error(f"Error from weather service: {weather_data['error']}")
                        return jsonify({
                            "error": weather_data['error'],
                            "success": False,
                            "city_id": city_id,
                            "coordinates": {"lat": lat, "lng": lng}
                        }), 400
                    
                    # Return successful response
                    response_data = {
                        "success": True,
                        "city_id": city_id,
                        "city_name": city_id.replace('_', ' ').title(),  # Simple formatting for direct coord mode
                        "weather": weather_data,
                        "coordinates": {
                            "lat": lat,
                            "lng": lng
                        },
                        "note": "Using direct coordinates"
                    }
                    
                    response = make_response(jsonify(response_data))
                    return add_cache_headers(response, max_age=1800)  # Cache for 30 minutes
                
                except (ValueError, TypeError) as e:
                    current_app.logger.error(f"Error parsing direct coordinates: {e}")
                    # Fall back to city lookup if direct coordinates fail
                    current_app.logger.info("Falling back to city lookup due to coordinate error")
            
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
            
            # Perform city search
            current_app.logger.info(f"Looking up city with search term: '{search_query}'")
            cities = search_city(search_query)
            
            # Log all found cities 
            current_app.logger.info(f"Cities found: {len(cities)}")
            for city_found in cities:
                current_app.logger.info(f"  - Found city: {city_found['name']}, ID: {city_found['id']}")
            
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
                
                # If still no match, take the first result as fallback
                if not city:
                    city = cities[0]
                    current_app.logger.info(f"Using first result as fallback: {city['id']}")
            
            # If still no city found after all matching attempts, return error
            if not city:
                current_app.logger.error(f"No city found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_query}",
                    "success": False,
                    "city_id": city_id,
                    "search_details": {
                        "original_search_term": search_query,
                        "cities_found": len(cities)
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
            current_app.logger.info(f"State Code: {city.get('state_code', 'N/A')}")
            
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
            
            # Try to convert coordinates to float and validate ranges
            try:
                lat = float(lat)
                lng = float(lng)
                
                if abs(lat) > 90 or abs(lng) > 180:
                    current_app.logger.error(f"Coordinates out of valid range: lat={lat}, lng={lng}")
                    return jsonify({
                        "error": f"Coordinates out of valid range: lat={lat}, lng={lng}",
                        "success": False,
                        "city_details": city
                    }), 400
            except (ValueError, TypeError) as e:
                current_app.logger.error(f"Failed to convert coordinates to float: {e}")
                return jsonify({
                    "error": f"Invalid coordinate format: {e}",
                    "success": False,
                    "city_details": city
                }), 400
            
            # Get weather data with validated coordinates
            weather_data = get_weather_data(
                lat=lat,
                lng=lng,
                units=units
            )
            
            # Check if there was an error in the weather data
            if 'error' in weather_data:
                current_app.logger.error(f"Error in weather data: {weather_data['error']}")
                return jsonify({
                    "error": weather_data['error'],
                    "success": False,
                    "city_id": city['id'],
                    "city_name": city['name'],
                    "coordinates": {
                        "lat": lat,
                        "lng": lng
                    }
                }), 400
            
            # Build successful response
            response_data = {
                "success": True,
                "city_id": city['id'],
                "city_name": city['name'],
                "country": city.get('country', ''),
                "state": city.get('state', ''),
                "state_code": city.get('state_code', ''),  # Include state_code in response
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
            
    @app.route('/api/radar', methods=['GET'])
    @limiter.limit("10 per minute")
    def get_radar():
        """Get radar data for weather maps"""
        current_app.logger.info("RADAR ENDPOINT CALLED")
        
        try:
            # Get radar data
            radar_data = get_radar_data()
            
            # Check for error in radar data
            if 'error' in radar_data:
                current_app.logger.error(f"Error from radar service: {radar_data['error']}")
                return jsonify({
                    "error": radar_data['error'],
                    "success": False
                }), 400
            
            # Return successful response
            response_data = {
                "success": True,
                "radar": radar_data
            }
            
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=600)  # Cache for 10 minutes
            
        except Exception as e:
            current_app.logger.error(f"Radar error: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "error_details": {
                    "exception_type": type(e).__name__,
                    "full_trace": str(e)
                }
            }), 500
            
    @app.route('/api/radar/tile', methods=['GET'])
    @limiter.limit("60 per minute")
    def get_radar_tile():
        """Get radar tile URL for a specific location and frame"""
        current_app.logger.info("RADAR TILE ENDPOINT CALLED")
        
        try:
            # Parse parameters
            host = request.args.get('host')
            path = request.args.get('path')
            x = request.args.get('x')
            y = request.args.get('y')
            z = request.args.get('z')
            
            # Optional parameters with defaults
            color_scheme = int(request.args.get('color_scheme', 2))
            smooth = int(request.args.get('smooth', 1))
            snow = int(request.args.get('snow', 1))
            size = int(request.args.get('size', 256))
            tile_format = request.args.get('format', 'webp')
            
            # Validate required parameters
            if not all([host, path, x, y, z]):
                current_app.logger.error(f"Missing required radar tile parameters")
                return jsonify({
                    "error": "Missing required parameters: host, path, x, y, z",
                    "success": False
                }), 400
                
            # Convert coordinate parameters to integers
            try:
                x = int(x)
                y = int(y)
                z = int(z)
            except (ValueError, TypeError) as e:
                current_app.logger.error(f"Invalid tile coordinates: {e}")
                return jsonify({
                    "error": f"Invalid tile coordinates: {e}",
                    "success": False
                }), 400
                
            # Validate color scheme
            if color_scheme < 0 or color_scheme > 8:
                current_app.logger.error(f"Invalid color scheme: {color_scheme}")
                return jsonify({
                    "error": "Invalid color scheme: must be 0-8",
                    "success": False
                }), 400
                
            # Get tile URL
            tile_url = get_radar_tile_url(
                host=host,
                path=path,
                x=x,
                y=y,
                z=z,
                color_scheme=color_scheme,
                smooth=smooth,
                snow=snow,
                size=size,
                format=tile_format
            )
            
            # Return successful response
            response_data = {
                "success": True,
                "url": tile_url
            }
            
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=600)  # Cache for 10 minutes
            
        except Exception as e:
            current_app.logger.error(f"Radar tile error: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "error_details": {
                    "exception_type": type(e).__name__,
                    "full_trace": str(e)
                }
            }), 500