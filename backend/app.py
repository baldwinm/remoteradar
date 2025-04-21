# app.py
import os
import logging
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

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
    
    # Enable CORS
    CORS(app)
    
    # Set up logging
    setup_logging(app)
    
    # Initialize rate limiter
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",
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
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        """Health check endpoint."""
        return jsonify({"status": "ok"})
    
    # Generic error handler
    @app.errorhandler(404)
    def not_found(e):
        """Handle 404 errors."""
        return jsonify({"error": "Not found"}), 404
    
    @app.errorhandler(500)
    def server_error(e):
        """Handle 500 errors."""
        app.logger.error(f"Server error: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500
    
    return app

# If using wsgi.py, this allows direct execution of this file
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config['ENV'] == 'development')