# utils/http_helpers.py
from flask import make_response, Response, jsonify
from datetime import datetime, timedelta
from typing import Union, Dict, Any

def add_cache_headers(response: Union[Response, Dict[str, Any]], max_age: int = 3600) -> Response:
    """
    Add caching headers to the response
    
    Args:
        response: Flask response object or dictionary
        max_age: Cache max age in seconds (default: 1 hour)
        
    Returns:
        Flask response with cache headers
    """
    # If response is a dictionary, convert it to a Response object
    if isinstance(response, dict):
        response = jsonify(response)
    
    # Set Cache-Control header
    response.headers['Cache-Control'] = f'public, max-age={max_age}'
    
    # Set Expires header
    response.headers['Expires'] = (
        datetime.utcnow() + timedelta(seconds=max_age)
    ).strftime('%a, %d %b %Y %H:%M:%S GMT')
    
    # Add Vary header for better caching behavior
    response.headers.setdefault('Vary', 'Accept-Encoding, Origin')
    
    return response
