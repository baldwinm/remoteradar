# app.py
import os
import time
import logging
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded

# Import API route registrations
from api.cities import register_cities_routes
from api.places import register_places_routes
from api.accommodation import register_accommodation_routes
from api.images import register_images_routes
from api.weather import register_weather_routes

# Import utilities
from utils.logging_config import setup_logging
from utils.cache import init_cache, clean_memory_cache

def create_app(test_config=None):
    """Create and configure the Flask application."""
    
    # Create Flask app
    app = Flask(__name__, static_folder='../build', static_url_path='/')
    
    # Configure app
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev'),
        ENV=os.environ.get('FLASK_ENV', 'development'),
    )
    
    # Apply environment-specific config
    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)
    
    # Enable CORS with more comprehensive configuration
    cors_origins = [
        'https://remoteradar.net',  # Production domain
        'http://localhost:3000',    # Local development
        'https://www.remoteradar.net'  # WWW subdomain
    ]
    
    # Modify CORS to handle multiple origins cleanly
    CORS(app, 
         resources={
             r"/api/*": {
                 "origins": cors_origins,
                 "allow_headers": [
                     "Content-Type", 
                     "Authorization", 
                     "Access-Control-Allow-Credentials"
                 ],
                 "supports_credentials": True,
                 "methods": ["GET", "POST", "OPTIONS"]
             }
         },
         # Ensure only one origin is returned
         origin_regex=True
    )
    
    # Set up logging
    setup_logging(app)
    
    # Initialize rate limiter with more flexible storage and configuration
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",
        strategy="fixed-window",  # Use fixed window strategy
        default_limits_deduct_when=lambda resp: resp.status_code < 500,  # Only count successful requests
    )
    
    # Initialize the memory cache
    init_cache()
    
    # Register API routes
    register_cities_routes(app, limiter)
    register_places_routes(app, limiter)
    register_accommodation_routes(app, limiter)
    register_images_routes(app, limiter)
    register_weather_routes(app, limiter)
    
    # Add memory cache cleaning endpoint (for admin use)
    @app.route('/api/admin/clean-cache', methods=['POST'])
    @limiter.limit("5 per hour")
    def api_clean_cache():
        """Clean expired items from the memory cache."""
        try:
            clean_memory_cache(app)
            return jsonify({"success": True, "message": "Cache cleaned successfully"})
        except Exception as e:
            app.logger.error(f"Error cleaning cache: {str(e)}", exc_info=True)
            return jsonify({"success": False, "error": str(e)}), 500
    
    # Health check endpoint with very permissive rate limiting
    @app.route('/health', methods=['GET'])
    @app.route('/api/health', methods=['GET'])
    @limiter.limit("500 per minute")  # Increased rate limit for health checks
    def health_check():
        """Health check endpoint with multiple route support."""
        app.logger.info(f"Health check from IP: {request.remote_addr}")
        return jsonify({
            "status": "ok", 
            "timestamp": int(time.time()),
            "process_id": os.getpid()
        }), 200
    
    # Preflight request handler for CORS using standard route method
    @app.route('/api/city-image', methods=['OPTIONS'])
    def handle_preflight():
        """Handle CORS preflight requests for city image endpoint"""
        # Get the requesting origin
        origin = request.headers.get('Origin')
        
        # Create response
        response = make_response()
        
        # Set CORS headers dynamically
        if origin in cors_origins:
            response.headers.add("Access-Control-Allow-Origin", origin)
        
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,OPTIONS")
        response.headers.add("Access-Control-Allow-Credentials", "true")
        
        return response
    
    # Serve index.html for all routes (for SPA)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        """Serve the static files from the build directory."""
        app.logger.debug(f"Serving path: {path}")
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return app.send_static_file(path)
        else:
            return app.send_static_file('index.html')
    
    # Specific handler for rate limit exceeded errors
    @app.errorhandler(RateLimitExceeded)
    def handle_rate_limit_error(e):
        """Handle rate limiting errors with a more informative response."""
        app.logger.warning(f"Rate limit exceeded: {str(e)}")
        return jsonify({
            "error": "Rate limit exceeded", 
            "message": "Too many requests. Please wait and try again later.",
            "retry_after": 60  # Suggest waiting 1 minute
        }), 429
    
    # Generic error handler
    @app.errorhandler(404)
    def not_found(e):
        """Handle 404 errors."""
        app.logger.warning(f"404 Not Found: {request.url}")
        return jsonify({"error": "Not found", "path": request.path}), 404
    
    @app.errorhandler(500)
    def server_error(e):
        """Handle 500 errors."""
        app.logger.error(f"Server error: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500
    
    # Global exception handler
    @app.errorhandler(Exception)
    def handle_exception(e):
        """Log all uncaught exceptions"""
        app.logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    
    return app

# Create the app when this module is imported
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config['ENV'] == 'development')
