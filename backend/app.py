# app.py
# Add this at the top to help Python find your modules
import sys
import os
# Add the current directory to Python's path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from flask import Flask, request, g, make_response  # Added make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import time
import random
import json

# Import utility modules
from utils.logging_config import setup_logging
from utils.cache import init_cache, clean_memory_cache

# Import API route modules
from api.cities import register_cities_routes
from api.places import register_places_routes
from api.accommodation import register_accommodation_routes
from api.images import register_images_routes

# Load environment variables
load_dotenv()

# Create and configure the app
def create_app():
    app = Flask(__name__)
    
    # Configure app based on environment
    app.config['ENV'] = os.environ.get('FLASK_ENV', 'development')
    
    # Explicitly defined allowed origins
    allowed_origins = [
        "https://remoteradar.net",
        "https://www.remoteradar.net",
        "http://localhost:3000",
        "https://remote-radar-frontend.onrender.com"
    ]
    
    # Configure CORS
    if app.config['ENV'] == 'development':
        # In development, allow all origins
        CORS(app, supports_credentials=True)
    else:
        # In production, use specific origins
        CORS(app, 
             origins=allowed_origins, 
             supports_credentials=True,
             resources={
                 r"/api/*": {
                     "origins": allowed_origins,
                     "allow_headers": [
                         "Content-Type", 
                         "Authorization", 
                         "Access-Control-Allow-Credentials"
                     ],
                     "supports_credentials": True
                 }
             }
        )
    
    # Configure rate limiting
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",
        strategy="fixed-window"
    )
    
    # Initialize logging
    setup_logging(app)
    
    # Initialize cache
    init_cache()
    
    # Log loaded API keys (masked for security)
    def mask_api_key(key):
        if not key or key.startswith('YOUR_'):
            return key
        return key[:4] + '*' * (len(key) - 8) + key[-4:]

    opencage_api_key = os.getenv('OPENCAGE_API_KEY', 'YOUR_OPENCAGE_API_KEY_HERE')
    mapbox_api_key = os.getenv('MAPBOX_API_KEY', 'YOUR_MAPBOX_API_KEY_HERE')
    
    app.logger.info(f"Loaded OpenCage API Key: {mask_api_key(opencage_api_key)}")
    app.logger.info(f"Loaded Mapbox API Key: {mask_api_key(mapbox_api_key)}")
    
    # Health check endpoint
    @app.route('/')
    def index():
        """Root endpoint that redirects to health check"""
        app.logger.info("Root endpoint accessed")
        return "Remote Radar API - Use specific endpoints"

    @limiter.exempt
    @app.route('/health')
    def health_check():
        app.logger.info("Health check endpoint called")
        return {"status": "healthy"}
    
    # Register route blueprints
    register_cities_routes(app, limiter)
    register_places_routes(app, limiter)
    register_accommodation_routes(app, limiter)
    register_images_routes(app, limiter)
    
    # Set up periodic cache cleaning
    @app.before_request
    def before_request_tasks():
        # Set start time for request timing
        g.start_time = time.time()
        app.logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")
        
        # Clean cache approximately once every 100 requests
        if random.randint(1, 100) == 1:
            clean_memory_cache(app)
    
    # Request completion logging
    @app.after_request
    def after_request(response):
        try:
            diff = time.time() - g.start_time
            app.logger.info(f"Response: {request.method} {request.path} {response.status_code} in {diff:.4f}s")
        except Exception as e:
            app.logger.error(f"Error in after_request: {str(e)}")
        return response
    
    # Global error handler
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
        return "Internal Server Error", 500
    
    return app

# Create the app instance for import
app = create_app()

if __name__ == '__main__':
    # Start the app with appropriate parameters for the environment
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
