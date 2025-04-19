# app.py
from flask import Flask, jsonify, request, make_response, g
from flask_cors import CORS
import os
import requests
from dotenv import load_dotenv
import json
import re
import time
import random
import logging
import sys
from logging.handlers import RotatingFileHandler
from datetime import datetime, timedelta
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables
# In production, this loads from environment variables set in Render
load_dotenv()

# Setup logging configuration
def setup_logging(app):
    """Configure comprehensive logging for Flask application"""
    
    # Determine log level based on environment
    if os.environ.get('FLASK_ENV') == 'production':
        log_level = logging.INFO
    else:
        log_level = logging.DEBUG
    
    # Clear any existing handlers to prevent duplicate logs
    if app.logger.handlers:
        app.logger.handlers.clear()
    
    # Create a formatter with detailed information
    formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] [%(process)d] [%(thread)d] '
        '[%(pathname)s:%(lineno)d] - %(message)s'
    )
    
    # Create console handler for all logs
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    app.logger.addHandler(console_handler)
    
    # Create log directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Create file handler for all logs
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'app.log'), 
        maxBytes=10485760,  # 10MB
        backupCount=10
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(log_level)
    app.logger.addHandler(file_handler)
    
    # Create file handler for errors (ERROR and above)
    error_handler = RotatingFileHandler(
        os.path.join(log_dir, 'error.log'), 
        maxBytes=10485760,  # 10MB
        backupCount=10
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    app.logger.addHandler(error_handler)
    
    # Set the logger level
    app.logger.setLevel(log_level)
    
    app.logger.info("Logging setup complete")
    
    return app

# Initialize Flask app
app = Flask(__name__)

# Configure logging
setup_logging(app)

# API Keys and configuration
OPENCAGE_API_KEY = os.getenv('OPENCAGE_API_KEY', 'YOUR_OPENCAGE_API_KEY_HERE')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', 'YOUR_GOOGLE_API_KEY_HERE')
AIRBNB_API_KEY = os.getenv('AIRBNB_API_KEY', 'YOUR_AIRBNB_API_KEY_HERE')
UNSPLASH_API_KEY = os.getenv('UNSPLASH_API_KEY', 'YOUR_UNSPLASH_API_KEY_HERE')
AIRBNB_API_URL = "https://airbnb19.p.rapidapi.com/api/v1/searchPropertyByLocationV2"
OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"
UNSPLASH_API_URL = "https://api.unsplash.com/search/photos"

# Log loaded API keys (masked for security)
def mask_api_key(key):
    if not key or key.startswith('YOUR_'):
        return key
    return key[:4] + '*' * (len(key) - 8) + key[-4:]

app.logger.info(f"Loaded OpenCage API Key: {mask_api_key(OPENCAGE_API_KEY)}")
app.logger.info(f"Loaded Google API Key: {mask_api_key(GOOGLE_API_KEY)}")
app.logger.info(f"Loaded Airbnb API Key: {mask_api_key(AIRBNB_API_KEY)}")
app.logger.info(f"Loaded Unsplash API Key: {mask_api_key(UNSPLASH_API_KEY)}")

# Configure CORS for production
if os.getenv('FLASK_ENV') == 'development':
    # In development, allow all origins
    app.logger.info("Running in development mode, CORS configured to allow all origins")
    CORS(app)
else:
    # In production, only allow your domain
    allowed_origins = [
        f"https://{os.getenv('ALLOWED_DOMAIN', 'remoteradar.net')}",
        f"https://www.{os.getenv('ALLOWED_DOMAIN', 'remoteradar.net')}",
        "https://remoteradar.net",
        "https://www.remoteradar.net",
        "https://remote-radar-frontend.onrender.com"
    ]
    app.logger.info(f"Running in production mode, CORS configured for: {allowed_origins}")
    CORS(app, origins=allowed_origins)

# Configure rate limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
    strategy="fixed-window"
)

# Configure request logging
@app.before_request
def before_request():
    g.start_time = time.time()
    app.logger.debug(f"Request: {request.method} {request.path} from {request.remote_addr}")

@app.after_request
def after_request(response):
    try:
        diff = time.time() - g.start_time
        app.logger.info(
            f"Response: {request.method} {request.path} {response.status_code} in {diff:.4f}s"
        )
    except Exception as e:
        app.logger.error(f"Error in after_request: {str(e)}")
    return response

# Simple in-memory cache
cache = {
    'cities': {},
    'places': {},
    'accommodations': {},
    'place_details': {},
    'city_images': {},
    'api_requests': {}
}

# This should be the only health check endpoint in your code
@limiter.exempt
@app.route('/health')
def health_check():
    app.logger.info("Health check endpoint called")
    return jsonify({"status": "healthy"})

# ---------- Helper Functions ----------

def add_cache_headers(response, max_age=3600):
    """Add caching headers to the response"""
    response.headers['Cache-Control'] = f'public, max-age={max_age}'
    response.headers['Expires'] = (datetime.utcnow() + timedelta(seconds=max_age)).strftime('%a, %d %b %Y %H:%M:%S GMT')
    return response

def make_api_request(url, params=None, headers=None, timeout=10, cache_key=None, ttl=None):
    """Enhanced API request function with caching"""
    
    # Default TTL if not specified
    if ttl is None:
        # Find the appropriate TTL based on URL
        if 'opencagedata' in url:
            ttl = 604800  # 7 days
        elif 'maps.googleapis' in url:
            ttl = 43200   # 12 hours
        elif 'airbnb' in url:
            ttl = 7200    # 2 hours
        elif 'unsplash' in url:
            ttl = 86400   # 1 day
        else:
            ttl = 3600    # Default 1 hour
    
    # Check cache first if cache_key provided
    if cache_key and 'api_requests' in cache and cache_key in cache['api_requests']:
        cache_entry = cache['api_requests'][cache_key]
        # Check if cache is still valid
        if time.time() - cache_entry['timestamp'] < ttl:
            app.logger.debug(f"Using cached API response for {cache_key}")
            return cache_entry['data']
    
    # Make the actual request
    try:
        app.logger.info(f"Making API request to {url}")
        response = requests.get(url, params=params, headers=headers, timeout=timeout)
        
        if response.status_code == 200:
            data = response.json()
            
            # Cache the result if cache_key provided
            if cache_key:
                if 'api_requests' not in cache:
                    cache['api_requests'] = {}
                cache['api_requests'][cache_key] = {
                    'data': data,
                    'timestamp': time.time()
                }
            
            return data
        else:
            app.logger.error(f"API request failed: {response.status_code}")
            app.logger.debug(f"Response: {response.text[:200]}...")
            return None
    except Exception as e:
        app.logger.error(f"API request exception: {str(e)}")
        return None

def clean_memory_cache():
    """Periodically clean expired items from the memory cache"""
    app.logger.info("Cleaning memory cache...")
    now = time.time()
    
    # Define TTL for different cache types
    ttls = {
        'cities': 604800,      # 7 days
        'places': 43200,       # 12 hours
        'accommodations': 7200, # 2 hours
        'place_details': 86400, # 1 day
        'city_images': 86400,   # 1 day
        'api_requests': 3600    # 1 hour by default
    }
    
    # Clean each cache category
    for category, items in cache.items():
        if category == 'api_requests':
            # API requests cache items have their own timestamps
            to_remove = []
            for key, item in items.items():
                if now - item['timestamp'] > item.get('ttl', ttls[category]):
                    to_remove.append(key)
            
            for key in to_remove:
                del items[key]
        else:
            # Other cache items use a standard TTL
            to_remove = []
            for key, item in items.items():
                if 'timestamp' in item and now - item['timestamp'] > ttls.get(category, 3600):
                    to_remove.append(key)
            
            for key in to_remove:
                del items[key]
    
    app.logger.info(f"Cache cleaning complete. Current cache size: {sum(len(items) for items in cache.values())} items")

def search_city(query):
    """Search for a city using OpenCage API"""
    app.logger.info(f"Searching for city with query: '{query}'")
    
    if not query or len(query) < 2:
        app.logger.warning(f"Query too short: '{query}'")
        return []
    
    # Check cache first
    cache_key = f"city_search_{query.lower()}"
    if 'cities' in cache and cache_key in cache['cities']:
        app.logger.info(f"Using cached city search for {query}")
        cached_result = cache['cities'][cache_key]
        # Check if cache is still valid (7 days)
        if time.time() - cached_result['timestamp'] < 604800:
            return cached_result['data']
    
    if not OPENCAGE_API_KEY or OPENCAGE_API_KEY == "YOUR_OPENCAGE_API_KEY_HERE":
        app.logger.error("OpenCage API key not configured")
        return []
    
    try:
        # Make API request
        response = requests.get(
            OPENCAGE_BASE_URL,
            params={
                'q': query,
                'key': OPENCAGE_API_KEY,
                'limit': 5  
            }
        )
        
        if response.status_code != 200:
            app.logger.error(f"OpenCage API error: {response.status_code}")
            return []
        
        data = response.json()
        
        if not data or not data.get('results'):
            app.logger.info(f"No results found for query: '{query}'")
            return []
        
        # Process results
        cities = []
        for result in data['results']:
            components = result.get('components', {})
            
            # Get city name or equivalent
            city_name = (components.get('city') or components.get('town') or 
                        components.get('village') or components.get('state'))
            
            if not city_name:
                continue
                
            country_code = components.get('country_code', '').lower()
            city_id = f"{city_name.lower().replace(' ', '_')}_{country_code}"
            
            cities.append({
                'id': city_id,
                'name': city_name,
                'country': components.get('country', ''),
                'state': components.get('state', ''),
                'lat': result.get('geometry', {}).get('lat'),
                'lng': result.get('geometry', {}).get('lng'),
                'formatted': result.get('formatted', '')
            })
        
        app.logger.info(f"Found {len(cities)} cities for query: '{query}'")
        for city in cities:
            app.logger.debug(f"  - {city['name']} ({city['id']})")
        
        # Cache the result
        if 'cities' not in cache:
            cache['cities'] = {}
            
        cache['cities'][cache_key] = {
            'data': cities,
            'timestamp': time.time()
        }
        
        return cities
    except Exception as e:
        app.logger.error(f"Error searching for city: {str(e)}", exc_info=True)
        return []

def get_place_details(place_id):
    """Get detailed information for a specific place using its place_id"""
    if not place_id:
        return {}
        
    # Check cache first
    cache_key = f"place_details_{place_id}"
    if 'place_details' in cache and cache_key in cache['place_details']:
        cache_entry = cache['place_details'][cache_key]
        # Check if cache is still valid (1 day)
        if time.time() - cache_entry.get('timestamp', 0) < 86400:
            return cache_entry
    
    try:
        # Check if Google API key is configured
        if not GOOGLE_API_KEY or GOOGLE_API_KEY == "YOUR_GOOGLE_API_KEY_HERE":
            app.logger.error("Google API key not configured")
            return {}
            
        # Make API request to get place details including the website URL
        details_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={
                "key": GOOGLE_API_KEY,
                "place_id": place_id,
                "fields": "website,formatted_phone_number,url"  
            }
        )
        
        if details_response.status_code == 200:
            details_data = details_response.json()
            if details_data and details_data.get('status') == 'OK' and 'result' in details_data:
                result = details_data['result']
                
                # Extract the relevant details
                details = {
                    "website": result.get("website", ""),
                    "formatted_phone_number": result.get("formatted_phone_number", ""),
                    "google_maps_url": result.get("url", ""),
                    "timestamp": time.time()  # Add timestamp for cache expiration
                }
                
                # Cache the details
                if 'place_details' not in cache:
                    cache['place_details'] = {}
                cache['place_details'][cache_key] = details
                
                return details
                
        return {}
    
    except Exception as e:
        app.logger.error(f"Error getting place details: {str(e)}", exc_info=True)
        return {}

def get_places_data(city_id, city_name, lat, lng):
    """Get coffee shops, coworking spaces, and restaurants for a city"""
    app.logger.info(f"Getting places data for city_id: {city_id}, city_name: {city_name}")
    
    try:
        # Check cache first
        if city_id in cache.get('places', {}):
            cached_data = cache['places'][city_id]
            # Check if cache is still valid (12 hours)
            if time.time() - cached_data.get('timestamp', 0) < 43200:
                app.logger.info(f"Using cached places data for {city_id}")
                return cached_data
                
        # Check if Google API key is configured
        if not GOOGLE_API_KEY or GOOGLE_API_KEY == "YOUR_GOOGLE_API_KEY_HERE":
            app.logger.error("Google API key not configured")
            raise Exception("Google API key not configured")
        
        places = []
        place_ids = []  # To collect all place IDs for batch processing later
        
        # Search for coffee shops
        app.logger.info(f"Searching for coffee shops near {city_name}")
        coffee_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": GOOGLE_API_KEY,
                "location": f"{lat},{lng}",
                "radius": 3000,  # 3km radius
                "type": "cafe",
                "keyword": "coffee"
            }
        )
        
        if coffee_response.status_code == 200:
            coffee_data = coffee_response.json()
            if coffee_data and 'results' in coffee_data:
                app.logger.info(f"Found {len(coffee_data['results'])} coffee shops")
                for place in coffee_data['results']:
                    place_id = place.get("place_id")
                    if place_id:
                        place_ids.append(place_id)
                    
                    places.append({
                        "id": place_id or f"coffee_{len(places)}",
                        "name": place.get("name", "Coffee Shop"),
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating", 0),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "lat": place.get("geometry", {}).get("location", {}).get("lat", lat),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng", lng),
                        "type": "coffee",
                        "website": "",  # Will be filled in later
                        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "",
                        "phone": ""  # Will be filled in later
                    })
        else:
            app.logger.error(f"Error searching for coffee shops: {coffee_response.status_code}")
        
        # Search for coworking spaces
        app.logger.info(f"Searching for coworking spaces near {city_name}")
        coworking_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": GOOGLE_API_KEY,
                "location": f"{lat},{lng}",
                "radius": 5000,  # 5km radius (wider search for coworking)
                "keyword": "coworking space"
            }
        )
        
        if coworking_response.status_code == 200:
            coworking_data = coworking_response.json()
            if coworking_data and 'results' in coworking_data:
                app.logger.info(f"Found {len(coworking_data['results'])} coworking spaces")
                for place in coworking_data['results']:
                    place_id = place.get("place_id")
                    if place_id:
                        place_ids.append(place_id)
                    
                    places.append({
                        "id": place_id or f"coworking_{len(places)}",
                        "name": place.get("name", "Coworking Space"),
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating", 0),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "lat": place.get("geometry", {}).get("location", {}).get("lat", lat),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng", lng),
                        "type": "coworking",
                        "website": "",  # Will be filled in later
                        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "",
                        "phone": ""  # Will be filled in later
                    })
        else:
            app.logger.error(f"Error searching for coworking spaces: {coworking_response.status_code}")
        
        # Search for restaurants
        app.logger.info(f"Searching for restaurants near {city_name}")
        restaurant_response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": GOOGLE_API_KEY,
                "location": f"{lat},{lng}",
                "radius": 3000,  # 3km radius
                "type": "restaurant",
                "rankby": "prominence"  # Sort by prominence (rating & popularity)
            }
        )
        
        if restaurant_response.status_code == 200:
            restaurant_data = restaurant_response.json()
            if restaurant_data and 'results' in restaurant_data:
                app.logger.info(f"Found {len(restaurant_data['results'])} restaurants")
                for place in restaurant_data['results']:
                    place_id = place.get("place_id")
                    if place_id:
                        place_ids.append(place_id)
                    
                    places.append({
                        "id": place_id or f"restaurant_{len(places)}",
                        "name": place.get("name", "Restaurant"),
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating", 0),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "price_level": place.get("price_level", 0),  # Added price level for restaurants
                        "lat": place.get("geometry", {}).get("location", {}).get("lat", lat),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng", lng),
                        "type": "restaurant",
                        "website": "",  # Will be filled in later
                        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "",
                        "phone": ""  # Will be filled in later
                    })
        else:
            app.logger.error(f"Error searching for restaurants: {restaurant_response.status_code}")
        
        # Count the types of places
        coffee_count = sum(1 for place in places if place['type'] == 'coffee')
        coworking_count = sum(1 for place in places if place['type'] == 'coworking')
        restaurant_count = sum(1 for place in places if place['type'] == 'restaurant')
        
        # Sort places by rating (highest first)
        places.sort(key=lambda x: (x.get('rating', 0), x.get('user_ratings_total', 0)), reverse=True)
        
        # PERFORMANCE OPTIMIZATION: Only fetch details for top-rated places (first page)
        top_places = places[:15]  # Assuming 5 per page, get enough for first 3 pages
        place_details_dict = {}
        
        # Get details for just the top places
        for place in top_places:
            if place['id'].startswith('place_id:') or not place['id'] or '_' in place['id']:
                continue  # Skip if not a valid place_id
                
            # Get place details from cache or API
            details = get_place_details(place['id'])
            if details:
                place_details_dict[place['id']] = details
        
        # Apply the details to the places list
        for place in places:
            if place['id'] in place_details_dict:
                details = place_details_dict[place['id']]
                place['website'] = details.get('website', '')
                place['phone'] = details.get('formatted_phone_number', '')
        
        result = {
            "city_id": city_id,
            "city_name": city_name,
            "places": places,
            "counts": {
                "coffee": coffee_count,
                "coworking": coworking_count,
                "restaurant": restaurant_count,
                "total": len(places)
            },
            "timestamp": time.time()  # Add timestamp for cache expiration
        }
        
        # Cache the result
        if 'places' not in cache:
            cache['places'] = {}
        cache['places'][city_id] = result
        app.logger.info(f"Places data cached for {city_id}")
        return result
    
    except Exception as e:
        app.logger.error(f"Error getting places data: {str(e)}", exc_info=True)
        return {
            "city_id": city_id,
            "city_name": city_name,
            "error": str(e),
            "places": [],
            "counts": {"coffee": 0, "coworking": 0, "restaurant": 0, "total": 0}
        }

def parse_price(price_text):
    """Helper function to parse price from text"""
    if not price_text:
        return 0
        
    # Regex to extract the number after the currency symbol
    price_match = re.search(r'[$€£](\d+(?:,\d+)*(?:\.\d+)?)', price_text)
    if price_match:
        price_str = price_match.group(1).replace(',', '')
        try:
            return float(price_str)
        except ValueError:
            pass
    return 0

def fetch_accommodation_data(city_data, occupants=1):
    """Fetch Airbnb pricing information for a city"""
    app.logger.info(f"Fetching accommodation data for {city_data['name']}, occupants: {occupants}")
    
    try:
        # Check cache first
        cache_key = f"{city_data['id']}_{occupants}"
        if cache_key in cache.get('accommodations', {}):
            cached_data = cache['accommodations'][cache_key]
            # Check if cache is still valid (2 hours)
            if time.time() - cached_data.get('timestamp', 0) < 7200:
                app.logger.info(f"Using cached accommodation data for {cache_key}")
                return cached_data
        
        # Check if API key is missing
        if not AIRBNB_API_KEY or AIRBNB_API_KEY == "YOUR_AIRBNB_API_KEY_HERE":
            app.logger.error("Airbnb API key is not configured")
            raise Exception("Airbnb API key is not configured. Please provide a valid API key.")
        
        # Ensure occupants is an integer
        try:
            occupants_int = int(occupants)
        except (ValueError, TypeError):
            occupants_int = 1  # Default to 1 if conversion fails
        
        # Format location based on country
        city_name = city_data['name']
        country = city_data.get('country', '')
        state = city_data.get('state', '')
        
        location_query = city_name
        if state and country in ["United States of America", "United States"]:
            location_query = f"{city_name}, {state}"
        elif country and country not in ["United States of America", "United States"]:
            location_query = f"{city_name}, {country}"
        
        # Headers for the RapidAPI
        headers = {
            "x-rapidapi-key": AIRBNB_API_KEY,
            "x-rapidapi-host": "airbnb19.p.rapidapi.com"
        }
        
        # Set up parameters for the API request
        params = {
            "location": location_query,
            "totalRecords": 10,  # Number of properties to return
            "currency": "USD",
            "adults": occupants_int
        }
        
        app.logger.info(f"Making Airbnb API request for {location_query}")
        
        # Make the API request
        response = requests.get(AIRBNB_API_URL, headers=headers, params=params, timeout=20)
        
        if response.status_code != 200:
            app.logger.error(f"Airbnb API error: Status {response.status_code}")
            raise Exception(f"Airbnb API error: Status {response.status_code}")
        
        data = response.json()
        
        # Check if we got valid data in the expected format
        if not data or "status" not in data or not data["status"] or "data" not in data or "list" not in data["data"]:
            app.logger.error("API response didn't match expected format")
            raise Exception("API response didn't match expected format")
        
        # Process the listings
        listing_items = data["data"]["list"]
        app.logger.info(f"Found {len(listing_items)} properties in the API response")
        
        # Extract the properties with simplified data structure
        accommodations = []
        for item in listing_items:
            listing = item.get("listing", {})
            pricing = item.get("pricingQuote", {})
            
            # Basic details
            property_id = listing.get("id", "")
            property_name = listing.get("name", "")
            property_type = listing.get("title", "")
            rating = listing.get("avgRatingLocalized", "Not rated")
            
            # Price information
            stay_price = pricing.get("structuredStayDisplayPrice", {})
            primary_line = stay_price.get("primaryLine", {})
            
            # Get price value
            price_text = ""
            if "discountedPrice" in primary_line:
                price_text = primary_line.get("discountedPrice", "")
            else:
                price_text = primary_line.get("price", "")
            
            # Parse price - Airbnb API returns price per night directly
            price_per_night = parse_price(price_text)
            
            # Get image URL
            image_url = ""
            pictures = listing.get("contextualPictures", [])
            if pictures and len(pictures) > 0:
                image_url = pictures[0].get("picture", "")
            
            # Get all images for gallery (limited to 5)
            images = []
            for pic in pictures[:5]:
                if "picture" in pic:
                    images.append(pic["picture"])
            
            # Simplified accommodation object
            accommodations.append({
                "id": property_id,
                "title": property_name,
                "property_type": property_type,
                "rating": rating,
                "price_per_night": round(price_per_night, 2),  # This is already the per night price
                "price_total": price_text,
                "image_url": image_url,
                "images": images,
                "lat": listing.get("coordinate", {}).get("latitude"),
                "lng": listing.get("coordinate", {}).get("longitude"),
                "web_url": listing.get("webURL", "")
            })
        
        # Calculate average price
        avg_price = 0
        if accommodations:
            avg_price = sum(acc['price_per_night'] for acc in accommodations) / len(accommodations)
        
        result = {
            "city_id": city_data['id'],
            "city_name": city_data['name'],
            "average_price": round(avg_price, 2),
            "accommodations": accommodations,
            "timestamp": time.time()  # Add timestamp for cache expiration
        }
        
        # Cache the result
        if 'accommodations' not in cache:
            cache['accommodations'] = {}
        cache['accommodations'][cache_key] = result
        
        return result
    
    except Exception as e:
        app.logger.error(f"Error fetching accommodation data: {str(e)}", exc_info=True)
        return {
            "city_id": city_data.get('id', ''),
            "city_name": city_data.get('name', ''),
            "error": str(e),
            "average_price": 0,
            "accommodations": []
        }

# ---------- API Routes ----------

@app.route('/api/cities', methods=['GET'])
@limiter.limit("15 per minute")
def get_cities():
    """Search for cities"""
    search_query = request.args.get('q', '')
    
    if not search_query:
        return jsonify([])
    
    try:
        app.logger.info(f"API ENDPOINT: /api/cities?q={search_query}")
        cities = search_city(search_query)
        
        # For debugging, print full details of found cities
        app.logger.info(f"Found {len(cities)} cities for search query: '{search_query}'")
        for city in cities:
            app.logger.debug(f"  - City details: {json.dumps(city)}")
        
        response = make_response(jsonify(cities))
        return add_cache_headers(response, max_age=86400)  # Cache for 1 day
    except Exception as e:
        app.logger.error(f"City search error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/places/<city_id>', methods=['GET'])
@limiter.limit("5 per minute")
def get_places(city_id):
    """Get coffee shops, coworking spaces, and restaurants for a city"""
    try:
        app.logger.info(f"API ENDPOINT: /api/places/{city_id}")
        
        # First, find city info
        search_term = city_id.split('_')[0].replace('_', ' ')
        app.logger.info(f"Searching for city with term: '{search_term}' derived from city_id: '{city_id}'")
        cities = search_city(search_term)
        
        city = None
        for c in cities:
            app.logger.debug(f"Comparing city ID: {c['id']} with requested ID: {city_id}")
            if c['id'] == city_id:
                city = c
                app.logger.info("MATCH FOUND!")
                break
        
        if not city:
            # Try a more flexible search approach
            app.logger.info("City not found with exact ID match, trying looser matching...")
            parts = city_id.split('_')
            country_code = parts[-1] if len(parts) > 1 else None
            
            # Try full city name search
            full_city_name = '_'.join(parts[:-1]).replace('_', ' ') if country_code else city_id.replace('_', ' ')
            app.logger.info(f"Searching with full city name: '{full_city_name}'")
            
            cities_retry = search_city(full_city_name)
            
            if cities_retry and country_code:
                # Look for country code match
                for c in cities_retry:
                    c_country_code = c['id'].split('_')[-1]
                    if c_country_code == country_code:
                        city = c
                        app.logger.info(f"Found match with country code: {c['id']}")
                        break
            
            # If still not found, take the first result
            if not city and cities_retry:
                city = cities_retry[0]
                app.logger.info(f"Taking first result as fallback: {city['id']}")
            
            if not city:
                app.logger.error(f"City not found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_term}",
                    "success": False,
                    "search_term": search_term,
                    "city_id": city_id
                }), 404
        
        # Log the city data we found
        app.logger.info(f"Found city: {city['name']} (ID: {city['id']})")
        app.logger.info(f"Location: lat={city['lat']}, lng={city['lng']}")
        
        # Get places data
        places_data = get_places_data(city_id, city['name'], city['lat'], city['lng'])
        
        # Filter by type if specified
        place_type = request.args.get('type', 'all')
        if place_type != 'all' and 'places' in places_data:
            places_data['places'] = [p for p in places_data['places'] if p['type'] == place_type]
            
        response_data = {"success": True, **places_data}
        response = make_response(jsonify(response_data))
        return add_cache_headers(response, max_age=3600)  # Cache for 1 hour
    
    except Exception as e:
        app.logger.error(f"Places error: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "error": str(e),
            "success": False,
            "city_id": city_id,
            "places": []
        }), 500

@app.route('/api/accommodation/<city_id>', methods=['GET'])
@limiter.limit("5 per minute")
def get_accommodation(city_id):
    """Get Airbnb pricing information for a city"""
    # Parse occupants parameter with error handling
    try:
        occupants = int(request.args.get('occupants', 1))
    except ValueError:
        occupants = 1
    
    app.logger.info(f"API ENDPOINT: /api/accommodation/{city_id}?occupants={occupants}")
    
    try:
        # First, find city info using the same more robust approach from get_places
        search_term = city_id.split('_')[0].replace('_', ' ')
        app.logger.info(f"Searching for city with term: '{search_term}' derived from city_id: '{city_id}'")
        cities = search_city(search_term)
        
        city = None
        # Try exact match first
        for c in cities:
            if c['id'] == city_id:
                city = c
                app.logger.info(f"Found exact match: {c['id']}")
                break
        
        if not city:
            # Try alternative matching approaches
            app.logger.info("City not found with exact ID match, trying looser matching...")
            parts = city_id.split('_')
            country_code = parts[-1] if len(parts) > 1 else None
            
            # Try full city name search
            full_city_name = '_'.join(parts[:-1]).replace('_', ' ') if country_code else city_id.replace('_', ' ')
            app.logger.info(f"Searching with full city name: '{full_city_name}'")
            
            cities_retry = search_city(full_city_name)
            
            if cities_retry and country_code:
                # Look for country code match
                for c in cities_retry:
                    c_country_code = c['id'].split('_')[-1]
                    if c_country_code == country_code:
                        city = c
                        app.logger.info(f"Found match with country code: {c['id']}")
                        break
            
            # If still not found, take the first result
            if not city and cities_retry:
                city = cities_retry[0]
                app.logger.info(f"Taking first result as fallback: {city['id']}")
        
        if not city:
            app.logger.error(f"City not found for city_id: {city_id}")
            return jsonify({
                "error": f"City not found for ID: {city_id}. Search term was: {search_term}",
                "success": False,
                "city_id": city_id,
                "average_price": 0,
                "accommodations": []
            }), 404
        
        # Log the city data we found
        app.logger.info(f"Found city for accommodation: {city['name']} (ID: {city['id']})")
        
        # Get accommodation data
        accommodation_data = fetch_accommodation_data(city, occupants)
        response_data = {"success": True, **accommodation_data}
        response = make_response(jsonify(response_data))
        return add_cache_headers(response, max_age=1800)  # Cache for 30 minutes
    
    except Exception as e:
        app.logger.error(f"Accommodation error: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "error": str(e),
            "success": False,
            "city_id": city_id,
            "average_price": 0,
            "accommodations": []
        }), 500

@app.route('/api/place-details/<place_id>', methods=['GET'])
@limiter.limit("15 per minute")
def get_single_place_details(place_id):
    """Get detailed information for a single place"""
    try:
        app.logger.info(f"API ENDPOINT: /api/place-details/{place_id}")
        
        details = get_place_details(place_id)
        
        if not details:
            app.logger.warning(f"Place details not found for ID: {place_id}")
            return jsonify({
                "error": "Place details not found",
                "success": False,
                "place_id": place_id
            }), 404
            
        response_data = {
            "success": True,
            "place_id": place_id,
            "details": details
        }
        response = make_response(jsonify(response_data))
        return add_cache_headers(response, max_age=86400)  # Cache for 1 day
        
    except Exception as e:
        app.logger.error(f"Place details error: {str(e)}", exc_info=True)
        return jsonify({
            "error": str(e),
            "success": False,
            "place_id": place_id
        }), 500

@app.route('/api/city-image', methods=['GET'])
@limiter.limit("20 per minute")
def get_city_image():
    """Get a city image from Unsplash API with enhanced logging"""
    city = request.args.get('city', '')
    country = request.args.get('country', '')
    
    # Log request details
    app.logger.info(f"City image request received for city='{city}', country='{country}'")
    
    if not city:
        app.logger.warning("City image request missing city parameter")
        return jsonify({
            "error": "City parameter is required",
            "success": False
        }), 400
    
    # Create cache key based on city and country
    cache_key = f"city_image_{city.lower()}_{country.lower()}"
    
    # Log cache checking
    app.logger.debug(f"Checking cache for key: {cache_key}")
    
    # Check cache first
    if 'city_images' in cache and cache_key in cache['city_images']:
        cached_data = cache['city_images'][cache_key]
        # Check if cache is still valid (1 day)
        if time.time() - cached_data.get('timestamp', 0) < 86400:
            app.logger.info(f"Using cached image for {city}, {country}")
            response = make_response(jsonify(cached_data))
            return add_cache_headers(response, max_age=86400)  # Cache for 1 day
    
    app.logger.info(f"No valid cache found for {cache_key}, fetching from Unsplash")
    
    try:
        # Check if Unsplash API key is missing
        if not UNSPLASH_API_KEY or UNSPLASH_API_KEY == "YOUR_UNSPLASH_API_KEY_HERE":
            app.logger.error("Unsplash API key is not configured")
            raise Exception("Unsplash API key is not configured")
        
        # Log the API key (first 4 chars) for debugging
        api_key_preview = UNSPLASH_API_KEY[:4] + "..." if UNSPLASH_API_KEY else "None"
        app.logger.debug(f"Using Unsplash API key starting with: {api_key_preview}")
        
        # Create search query
        search_query = f"{city} city"
        if country:
            search_query += f" {country}"
        
        app.logger.info(f"Unsplash search query: '{search_query}'")
        
        # Headers for the Unsplash API
        headers = {
            "Authorization": f"Client-ID {UNSPLASH_API_KEY}"
        }
        
        # Parameters for the API request
        params = {
            "query": search_query,
            "orientation": "landscape",
            "per_page": 10  # Get multiple options to choose from
        }
        
        app.logger.info(f"Making Unsplash API request for {search_query}")
        
        # Make the API request
        response = requests.get(UNSPLASH_API_URL, headers=headers, params=params, timeout=10)
        
        app.logger.debug(f"Unsplash API response status: {response.status_code}")
        
        if response.status_code != 200:
            app.logger.error(f"Unsplash API error: Status {response.status_code}")
            # Log first 200 chars of response for debugging
            response_preview = response.text[:200] if response.text else "No response body"
            app.logger.error(f"Response preview: {response_preview}")
            raise Exception(f"Unsplash API error: Status {response.status_code}")
        
        data = response.json()
        
        # Log response structure
        app.logger.debug(f"Unsplash API response structure: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        # Check if we got valid data
        if not data or "results" not in data or not data["results"]:
            app.logger.warning(f"No results from Unsplash for '{search_query}', trying fallback")
            
            # Fallback to just city name if combined search didn't work
            params["query"] = city
            response = requests.get(UNSPLASH_API_URL, headers=headers, params=params, timeout=10)
            
            if response.status_code != 200:
                app.logger.error(f"Unsplash API fallback error: Status {response.status_code}")
                raise Exception(f"Unsplash API fallback error: Status {response.status_code}")
            
            data = response.json()
            
            # If still no results, return error
            if not data or "results" not in data or not data["results"]:
                app.logger.error(f"No images found for city: {city}")
                raise Exception("No images found for this city")
        
        # Get a random result from the first 5 (or fewer if less than 5 are returned)
        results = data["results"]
        app.logger.info(f"Found {len(results)} image results for {city}")
        
        selected_image = random.choice(results[:min(5, len(results))])
        
        # Log selected image details (ID and user)
        app.logger.info(f"Selected image ID: {selected_image.get('id')}, by: {selected_image.get('user', {}).get('name')}")
        
        image_data = {
            "success": True,
            "url": selected_image["urls"]["regular"],
            "small_url": selected_image["urls"]["small"],
            "thumb_url": selected_image["urls"]["thumb"],
            "attribution": {
                "name": selected_image["user"]["name"],
                "username": selected_image["user"]["username"],
                "link": f"https://unsplash.com/@{selected_image['user']['username']}?utm_source=remote_radar&utm_medium=referral"
            },
            "unsplash_link": f"{selected_image['links']['html']}?utm_source=remote_radar&utm_medium=referral",
            "timestamp": time.time()  # Add timestamp for cache expiration
        }
        
        # Cache the result
        if 'city_images' not in cache:
            cache['city_images'] = {}
        cache['city_images'][cache_key] = image_data
        
        app.logger.info(f"Successfully cached city image for {city}")
        
        response = make_response(jsonify(image_data))
        return add_cache_headers(response, max_age=86400)  # Cache for 1 day
    
    except Exception as e:
        app.logger.error(f"Error fetching city image: {str(e)}", exc_info=True)
        return jsonify({
            "error": str(e),
            "success": False
        }), 500

# Set up a function to periodically clean the cache (call this in a separate thread or process)
# In production, you'd want to use a proper task scheduler like Celery
# For simplicity, we'll just run it occasionally based on request triggers
@app.before_request
def before_request():
    # Set start time for request timing
    g.start_time = time.time()
    app.logger.debug(f"Request: {request.method} {request.path} from {request.remote_addr}")
    
    # Clean cache approximately once every 100 requests
    if random.randint(1, 100) == 1:
        clean_memory_cache()

# Log all unhandled exceptions
@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
    return "Internal Server Error", 500

if __name__ == '__main__':
    # Start the app with appropriate parameters for the environment
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)