# api/radar.py
from flask import Blueprint, jsonify, request, make_response, current_app, send_file
import logging
import os
import sys
import json
import io
import time

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.radar import get_radar_data, get_radar_tile

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

# Set logging level to DEBUG for development
logger.setLevel(logging.DEBUG)

# Add a console handler if not present
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

def register_radar_routes(app, limiter):
    """Register all routes related to radar data"""
    
    @app.route('/api/radar/data', methods=['GET'])
    @limiter.limit("30 per minute")
    def radar_data():
        """Get radar data for weather maps"""
        current_app.logger.info("RADAR DATA ENDPOINT CALLED")
        
        try:
            # Add request debugging
            current_app.logger.debug(f"Request headers: {dict(request.headers)}")
            current_app.logger.debug(f"Request origin: {request.origin if hasattr(request, 'origin') else 'Not available'}")
            
            # Get radar data from the OpenWeatherMap service
            current_app.logger.debug("Calling get_radar_data service function")
            radar_data = get_radar_data()
            
            # Log received data structure
            current_app.logger.debug(f"Received radar_data with keys: {list(radar_data.keys() if isinstance(radar_data, dict) else [])}")
            
            # Check for error in radar data
            if 'error' in radar_data:
                current_app.logger.error(f"Error from radar service: {radar_data['error']}")
                return jsonify({
                    "error": radar_data['error'],
                    "success": False
                }), 400
            
            # Return successful response
            current_app.logger.debug("Preparing successful response")
            response_data = {
                "success": True,
                "radar": radar_data
            }
            
            # Log response size
            response_json = json.dumps(response_data)
            current_app.logger.debug(f"Response size: {len(response_json)} bytes")
            
            response = make_response(jsonify(response_data))
            return add_cache_headers(response, max_age=300)  # Cache for 5 minutes
            
        except Exception as e:
            current_app.logger.error(f"Radar data error: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "error_details": {
                    "exception_type": type(e).__name__,
                    "full_trace": str(e)
                }
            }), 500
            
    @app.route('/api/radar/tile', methods=['GET'])
    @limiter.limit("120 per minute")
    def radar_tile():
        """Get radar tile for a specific location and frame"""
        current_app.logger.info("RADAR TILE ENDPOINT CALLED")
        
        # More comprehensive query parameter logging
        query_params = {}
        for param, value in request.args.items():
            query_params[param] = value
        current_app.logger.debug(f"Query parameters: {query_params}")
        
        # Start timer for performance tracking
        start_time = time.time()
        
        try:
            # Parse parameters
            host = request.args.get('host')
            path = request.args.get('path')
            x = request.args.get('x')
            y = request.args.get('y')
            z = request.args.get('z')
            
            # Log the essential parameters
            current_app.logger.debug(f"Essential parameters: host={host}, path={path}, x={x}, y={y}, z={z}")
            
            # Optional parameters with defaults (for compatibility with previous code)
            color_scheme = int(request.args.get('color_scheme', 0))
            smooth = int(request.args.get('smooth', 1))
            snow = int(request.args.get('snow', 1))
            size = int(request.args.get('size', 256))
            tile_format = request.args.get('format', 'png')
            
            # Validate required parameters
            if not all([host, path, x, y, z]):
                missing_params = []
                if not host: missing_params.append('host')
                if not path: missing_params.append('path')
                if not x: missing_params.append('x')
                if not y: missing_params.append('y')
                if not z: missing_params.append('z')
                
                current_app.logger.error(f"Missing required radar tile parameters: {', '.join(missing_params)}")
                return jsonify({
                    "error": f"Missing required parameters: {', '.join(missing_params)}",
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
            
            # Get tile image data from OpenWeatherMap
            current_app.logger.debug("Calling get_radar_tile service function")
            tile_data = get_radar_tile(
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
            
            # Check if tile data was successfully retrieved
            if tile_data is None:
                current_app.logger.error(f"Failed to get radar tile")
                return jsonify({
                    "error": "Failed to get radar tile",
                    "success": False
                }), 404
            
            # Log successful tile retrieval
            elapsed_time = time.time() - start_time
            current_app.logger.debug(f"Tile retrieved successfully. Size: {len(tile_data)} bytes. Time: {elapsed_time:.2f}s")
            
            # Return tile image directly
            response = make_response(send_file(
                io.BytesIO(tile_data),
                mimetype=f'image/{tile_format}',
                as_attachment=False,
                download_name=f'radar_tile_{z}_{x}_{y}.{tile_format}'
            ))
            
            # Add appropriate caching headers
            return add_cache_headers(response, max_age=300)  # Cache for 5 minutes
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            current_app.logger.error(f"Radar tile error after {elapsed_time:.2f}s: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "error_details": {
                    "exception_type": type(e).__name__,
                    "full_trace": str(e)
                }
            }), 500
