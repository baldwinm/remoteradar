# api/radar.py
from flask import Blueprint, jsonify, request, make_response, current_app, send_file
import logging
import os
import sys
import json
import io

# Add parent directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import services
from services.radar import get_radar_data, get_radar_tile

# Import utilities
from utils.http_helpers import add_cache_headers

# Create logger
logger = logging.getLogger(__name__)

def register_radar_routes(app, limiter):
    """Register all routes related to radar data"""
    
    @app.route('/api/radar/data', methods=['GET'])
    @limiter.limit("30 per minute")
    def radar_data():
        """Get radar data for weather maps"""
        current_app.logger.info("RADAR DATA ENDPOINT CALLED")
        
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
        current_app.logger.debug(f"Query parameters: {request.args}")
        
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
            tile_format = request.args.get('format', 'png')
            
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
                
            # Get tile image data
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
            current_app.logger.error(f"Radar tile error: {str(e)}", exc_info=True)
            
            return jsonify({
                "error": str(e),
                "success": False,
                "error_details": {
                    "exception_type": type(e).__name__,
                    "full_trace": str(e)
                }
            }), 500
