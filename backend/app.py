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
    
    # Existing code continues...
    # (Keep the rest of the create_app function the same)
    
    return app

# Rest of the file remains the same
