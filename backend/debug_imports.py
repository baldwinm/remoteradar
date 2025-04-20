# debug_imports.py
"""
Utility script to debug import issues in the modular backend structure.
Run this file to check if all required modules can be imported correctly.
"""

import sys
import os

# Add the current directory to Python's path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

def debug_imports():
    """Test importing all required modules and report any issues"""
    print("=== DEBUGGING IMPORTS ===")
    print(f"Python version: {sys.version}")
    print(f"Python path: {sys.path}")
    
    # Check for required packages
    required_packages = ['flask', 'flask_cors', 'flask_limiter', 'dotenv', 'requests']
    for package in required_packages:
        try:
            __import__(package)
            print(f"✓ Successfully imported {package}")
        except ImportError as e:
            print(f"✗ Failed to import {package}: {str(e)}")
    
    print("\n=== API MODULES ===")
    # Check API modules
    api_modules = [
        'api.cities', 
        'api.places', 
        'api.accommodation', 
        'api.images'
    ]
    for module in api_modules:
        try:
            __import__(module)
            print(f"✓ Successfully imported {module}")
        except ImportError as e:
            print(f"✗ Failed to import {module}: {str(e)}")
    
    print("\n=== SERVICE MODULES ===")
    # Check service modules
    service_modules = [
        'services.opencage',
        'services.google_places',
        'services.airbnb',
        'services.unsplash'
    ]
    for module in service_modules:
        try:
            __import__(module)
            print(f"✓ Successfully imported {module}")
        except ImportError as e:
            print(f"✗ Failed to import {module}: {str(e)}")
    
    print("\n=== UTILITY MODULES ===")
    # Check utility modules
    utility_modules = [
        'utils.cache',
        'utils.logging_config',
        'utils.http_helpers'
    ]
    for module in utility_modules:
        try:
            __import__(module)
            print(f"✓ Successfully imported {module}")
        except ImportError as e:
            print(f"✗ Failed to import {module}: {str(e)}")
    
    # Check specific functions from modules
    print("\n=== CRITICAL FUNCTIONS ===")
    try:
        from services.opencage import search_city
        print("✓ Successfully imported search_city from services.opencage")
    except ImportError as e:
        print(f"✗ Failed to import search_city from services.opencage: {str(e)}")
    
    try:
        from services.google_places import get_places_data, get_place_details
        print("✓ Successfully imported get_places_data and get_place_details from services.google_places")
    except ImportError as e:
        print(f"✗ Failed to import functions from services.google_places: {str(e)}")
    
    try:
        from services.airbnb import fetch_accommodations
        print("✓ Successfully imported fetch_accommodations from services.airbnb")
    except ImportError as e:
        print(f"✗ Failed to import fetch_accommodations from services.airbnb: {str(e)}")
    
    print("\n=== DEBUG COMPLETE ===")

if __name__ == "__main__":
    debug_imports()
