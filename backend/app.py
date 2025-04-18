# app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import requests
from dotenv import load_dotenv
import json
import re
import time
from datetime import datetime
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables
# In production, this loads from environment variables set in Render
load_dotenv()

# API Keys and configuration
OPENCAGE_API_KEY = os.getenv('OPENCAGE_API_KEY', 'YOUR_OPENCAGE_API_KEY_HERE')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', 'YOUR_GOOGLE_API_KEY_HERE')
AIRBNB_API_KEY = os.getenv('AIRBNB_API_KEY', 'YOUR_AIRBNB_API_KEY_HERE')
AIRBNB_API_URL = "https://airbnb19.p.rapidapi.com/api/v1/searchPropertyByLocationV2"
OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"

app = Flask(__name__)

# Configure CORS for production
if os.getenv('FLASK_ENV') == 'development':
    # In development, allow all origins
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
    CORS(app, origins=allowed_origins)

# Configure rate limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
    strategy="fixed-window"
)

# Simple in-memory cache
cache = {
    'cities': {},
    'places': {},
    'accommodations': {},
    'place_details': {}
}

# This should be the only health check endpoint in your code
@limiter.exempt
@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"})

# ---------- Helper Functions ----------

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
        else:
            ttl = 3600    # Default 1 hour
    
    # Check cache first if cache_key provided
    if cache_key and 'api_requests' in cache and cache_key in cache['api_requests']:
        cache_entry = cache['api_requests'][cache_key]
        # Check if cache is still valid
        if time.time() - cache_entry['timestamp'] < ttl:
            print(f"Using cached API response for {cache_key}")
            return cache_entry['data']
    
    # Make the actual request
    try:
        print(f"Making API request to {url}")
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
            print(f"API request failed: {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            return None
    except Exception as e:
        print(f"API request exception: {e}")
        return None

def search_city(query):
    """Search for a city using OpenCage API"""
    print(f"Searching for city with query: '{query}'")
    
    if not OPENCAGE_API_KEY or OPENCAGE_API_KEY == "YOUR_OPENCAGE_API_KEY_HERE":
        print("OpenCage API key not configured")
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
            print(f"API error: {response.status_code}")
            return []
        
        data = response.json()
        
        if not data or not data.get('results'):
            print(f"No results found for query: '{query}'")
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
        
        print(f"Found {len(cities)} cities for query: '{query}'")
        for city in cities:
            print(f"  - {city['name']} ({city['id']})")
        
        return cities
    except Exception as e:
        print(f"Error searching for city: {e}")
        return []

def get_place_details(place_id):
    """Get detailed information for a specific place using its place_id"""
    if not place_id:
        return {}
        
    # Check cache first
    cache_key = f"place_details_{place_id}"
    if 'place_details' in cache and cache_key in cache['place_details']:
        return cache['place_details'][cache_key]
    
    try:
        # Check if Google API key is configured
        if not GOOGLE_API_KEY or GOOGLE_API_KEY == "YOUR_GOOGLE_API_KEY_HERE":
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
                    "google_maps_url": result.get("url", "")
                }
                
                # Cache the details
                if 'place_details' not in cache:
                    cache['place_details'] = {}
                cache['place_details'][cache_key] = details
                
                return details
                
        return {}
    
    except Exception as e:
        print(f"Error getting place details: {e}")
        return {}

def get_places_data(city_id, city_name, lat, lng):
    """Get coffee shops, coworking spaces, and restaurants for a city"""
    print(f"Getting places data for city_id: {city_id}, city_name: {city_name}")
    
    try:
        # Check cache first
        if city_id in cache['places']:
            print(f"Using cached places data for {city_id}")
            return cache['places'][city_id]
                
        places = []
        place_ids = []  # To collect all place IDs for batch processing later
        
        # Search for coffee shops
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
        
        # Search for coworking spaces
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
        
        # Search for restaurants
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
            }
        }
        
        # Cache the result
        cache['places'][city_id] = result
        print(f"Places data cached for {city_id}")
        return result
    
    except Exception as e:
        print(f"Error getting places data: {e}")
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
    print(f"Fetching accommodation data for {city_data['name']}, occupants: {occupants}")
    
    try:
        # Check cache first
        cache_key = f"{city_data['id']}_{occupants}"
        if cache_key in cache.get('accommodations', {}):
            print(f"Using cached accommodation data for {cache_key}")
            return cache['accommodations'][cache_key]
        
        # Check if API key is missing
        if not AIRBNB_API_KEY or AIRBNB_API_KEY == "YOUR_AIRBNB_API_KEY_HERE":
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
        
        print(f"Making Airbnb API request for {location_query}")
        
        # Make the API request
        response = requests.get(AIRBNB_API_URL, headers=headers, params=params, timeout=20)
        
        if response.status_code != 200:
            raise Exception(f"Airbnb API error: Status {response.status_code}")
        
        data = response.json()
        
        # Check if we got valid data in the expected format
        if not data or "status" not in data or not data["status"] or "data" not in data or "list" not in data["data"]:
            raise Exception("API response didn't match expected format")
        
        # Process the listings
        listing_items = data["data"]["list"]
        print(f"Found {len(listing_items)} properties in the API response")
        
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
            "accommodations": accommodations
        }
        
        # Cache the result
        if 'accommodations' not in cache:
            cache['accommodations'] = {}
        cache['accommodations'][cache_key] = result
        
        return result
    
    except Exception as e:
        print(f"Error fetching accommodation data: {e}")
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
        print(f"API ENDPOINT: /api/cities?q={search_query}")
        cities = search_city(search_query)
        
        # For debugging, print full details of found cities
        print(f"Found {len(cities)} cities for search query: '{search_query}'")
        for city in cities:
            print(f"  - City details: {json.dumps(city)}")
        
        return jsonify(cities)
    except Exception as e:
        print(f"City search error: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/places/<city_id>', methods=['GET'])
@limiter.limit("5 per minute")
print(f"DEBUG: Searching for city with ID: {city_id}")
print(f"DEBUG: OpenCage API Key configured: {bool(OPENCAGE_API_KEY and OPENCAGE_API_KEY != 'YOUR_OPENCAGE_API_KEY_HERE')}")
def get_places(city_id):
    """Get coffee shops, coworking spaces, and restaurants for a city"""
    try:
        print(f"API ENDPOINT: /api/places/{city_id}")
        
        # First, find city info
        search_term = city_id.split('_')[0].replace('_', ' ')
        print(f"Searching for city with term: '{search_term}' derived from city_id: '{city_id}'")
        cities = search_city(search_term)
        
        city = None
        for c in cities:
            print(f"Comparing city ID: {c['id']} with requested ID: {city_id}")
            if c['id'] == city_id:
                city = c
                print("MATCH FOUND!")
                break
        
        if not city:
            # Try a more flexible search approach
            print("City not found with exact ID match, trying looser matching...")
            parts = city_id.split('_')
            country_code = parts[-1] if len(parts) > 1 else None
            
            # Try full city name search
            full_city_name = '_'.join(parts[:-1]).replace('_', ' ') if country_code else city_id.replace('_', ' ')
            print(f"Searching with full city name: '{full_city_name}'")
            
            cities_retry = search_city(full_city_name)
            
            if cities_retry and country_code:
                # Look for country code match
                for c in cities_retry:
                    c_country_code = c['id'].split('_')[-1]
                    if c_country_code == country_code:
                        city = c
                        print(f"Found match with country code: {c['id']}")
                        break
            
            # If still not found, take the first result
            if not city and cities_retry:
                city = cities_retry[0]
                print(f"Taking first result as fallback: {city['id']}")
            
            if not city:
                print(f"City not found for city_id: {city_id}")
                return jsonify({
                    "error": f"City not found for ID: {city_id}. Search term was: {search_term}",
                    "success": False,
                    "search_term": search_term,
                    "city_id": city_id
                }), 404
        
        # Log the city data we found
        print(f"Found city: {city['name']} (ID: {city['id']})")
        print(f"Location: lat={city['lat']}, lng={city['lng']}")
        
        # Get places data
        places_data = get_places_data(city_id, city['name'], city['lat'], city['lng'])
        
        # Filter by type if specified
        place_type = request.args.get('type', 'all')
        if place_type != 'all' and 'places' in places_data:
            places_data['places'] = [p for p in places_data['places'] if p['type'] == place_type]
            
        return jsonify({"success": True, **places_data})
    
    except Exception as e:
        print(f"Places error: {e}")
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
    
    print(f"API ENDPOINT: /api/accommodation/{city_id}?occupants={occupants}")
    
    try:
        # First, find city info using the same more robust approach from get_places
        search_term = city_id.split('_')[0].replace('_', ' ')
        print(f"Searching for city with term: '{search_term}' derived from city_id: '{city_id}'")
        cities = search_city(search_term)
        
        city = None
        # Try exact match first
        for c in cities:
            if c['id'] == city_id:
                city = c
                print(f"Found exact match: {c['id']}")
                break
        
        if not city:
            # Try alternative matching approaches
            print("City not found with exact ID match, trying looser matching...")
            parts = city_id.split('_')
            country_code = parts[-1] if len(parts) > 1 else None
            
            # Try full city name search
            full_city_name = '_'.join(parts[:-1]).replace('_', ' ') if country_code else city_id.replace('_', ' ')
            print(f"Searching with full city name: '{full_city_name}'")
            
            cities_retry = search_city(full_city_name)
            
            if cities_retry and country_code:
                # Look for country code match
                for c in cities_retry:
                    c_country_code = c['id'].split('_')[-1]
                    if c_country_code == country_code:
                        city = c
                        print(f"Found match with country code: {c['id']}")
                        break
            
            # If still not found, take the first result
            if not city and cities_retry:
                city = cities_retry[0]
                print(f"Taking first result as fallback: {city['id']}")
        
        if not city:
            print(f"City not found for city_id: {city_id}")
            return jsonify({
                "error": f"City not found for ID: {city_id}. Search term was: {search_term}",
                "success": False,
                "city_id": city_id,
                "average_price": 0,
                "accommodations": []
            }), 404
        
        # Log the city data we found
        print(f"Found city for accommodation: {city['name']} (ID: {city['id']})")
        
        # Get accommodation data
        accommodation_data = fetch_accommodation_data(city, occupants)
        return jsonify({"success": True, **accommodation_data})
    
    except Exception as e:
        print(f"Accommodation error: {e}")
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
        print(f"API ENDPOINT: /api/place-details/{place_id}")
        
        details = get_place_details(place_id)
        
        if not details:
            return jsonify({
                "error": "Place details not found",
                "success": False,
                "place_id": place_id
            }), 404
            
        return jsonify({
            "success": True,
            "place_id": place_id,
            "details": details
        })
        
    except Exception as e:
        print(f"Place details error: {e}")
        return jsonify({
            "error": str(e),
            "success": False,
            "place_id": place_id
        }), 500