# config.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
OPENCAGE_API_KEY = os.getenv('OPENCAGE_API_KEY', 'YOUR_OPENCAGE_API_KEY_HERE')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', 'YOUR_GOOGLE_API_KEY_HERE')
AIRBNB_API_KEY = os.getenv('AIRBNB_API_KEY', 'YOUR_AIRBNB_API_KEY_HERE')
UNSPLASH_API_KEY = os.getenv('UNSPLASH_API_KEY', 'YOUR_UNSPLASH_API_KEY_HERE')

# API URLs
AIRBNB_API_URL = "https://airbnb19.p.rapidapi.com/api/v2/searchPropertyByLocation"
OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"
UNSPLASH_API_URL = "https://api.unsplash.com/search/photos"

# Cache TTLs (time-to-live in seconds)
CACHE_TTLS = {
    'cities': 604800,      # 7 days
    'places': 43200,       # 12 hours
    'accommodations': 7200, # 2 hours
    'place_details': 86400, # 1 day
    'city_images': 86400,   # 1 day
    'api_requests': 3600    # 1 hour by default
}

# HTTP Cache Headers (max-age in seconds)
HTTP_CACHE_HEADERS = {
    'cities': 86400,       # 1 day
    'places': 3600,        # 1 hour
    'accommodation': 1800, # 30 minutes
    'place_details': 86400, # 1 day
    'city_images': 86400,   # 1 day
}

# Rate Limits
RATE_LIMITS = {
    'cities': "15 per minute",
    'places': "5 per minute",
    'accommodation': "5 per minute",
    'place_details': "15 per minute",
    'city_images': "20 per minute",
}
