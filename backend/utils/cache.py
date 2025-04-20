# utils/cache.py
import time
import logging
from typing import Dict, Any, Optional

# Initialize logger
logger = logging.getLogger(__name__)

# Global in-memory cache dictionary
_cache = {}

def init_cache() -> None:
    """Initialize the global memory cache with all required categories"""
    global _cache
    
    _cache = {
        'cities': {},
        'places': {},
        'accommodations': {},
        'place_details': {},
        'city_images': {},  # Now used for Google Place photos instead of Unsplash
        'api_requests': {}
    }
    
    logger.info("Memory cache initialized")

def get_cache() -> Dict[str, Dict[str, Any]]:
    """Get the current cache object (for debugging/status)"""
    return _cache

def put_in_cache(category: str, key: str, data: Any) -> None:
    """
    Add an item to the cache
    
    Args:
        category: Cache category (cities, places, etc.)
        key: Unique identifier for the item
        data: Data to cache
    """
    if category not in _cache:
        _cache[category] = {}
    
    _cache[category][key] = {
        'data': data,
        'timestamp': time.time()
    }
    
    logger.debug(f"Added item to cache: {category}/{key}")

def get_from_cache(category: str, key: str, ttl: int = 3600) -> Optional[Any]:
    """
    Get an item from the cache if it exists and is not expired
    
    Args:
        category: Cache category (cities, places, etc.)
        key: Unique identifier for the item
        ttl: Time-to-live in seconds (default: 1 hour)
        
    Returns:
        Cached data or None if not found or expired
    """
    if category not in _cache or key not in _cache[category]:
        return None
        
    cached_item = _cache[category][key]
    
    # Check if cache is still valid
    if time.time() - cached_item.get('timestamp', 0) < ttl:
        logger.debug(f"Cache hit: {category}/{key}")
        return cached_item['data']
    else:
        logger.debug(f"Cache expired: {category}/{key}")
        return None

def remove_from_cache(category: str, key: str) -> bool:
    """
    Remove an item from the cache
    
    Args:
        category: Cache category (cities, places, etc.)
        key: Unique identifier for the item
        
    Returns:
        True if item was removed, False if not found
    """
    if category in _cache and key in _cache[category]:
        del _cache[category][key]
        logger.debug(f"Removed from cache: {category}/{key}")
        return True
    return False

def clean_memory_cache(app) -> None:
    """
    Periodically clean expired items from the memory cache
    
    Args:
        app: Flask application instance (for logging)
    """
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
    
    items_removed = 0
    
    # Clean each cache category
    for category, items in _cache.items():
        ttl = ttls.get(category, 3600)  # Default 1 hour TTL
        to_remove = []
        
        for key, item in items.items():
            if now - item.get('timestamp', 0) > ttl:
                to_remove.append(key)
        
        for key in to_remove:
            del items[key]
            items_removed += 1
    
    app.logger.info(f"Cache cleaning complete. Removed {items_removed} expired items.")
    app.logger.debug(f"Current cache size: {sum(len(items) for items in _cache.values())} items")

def get_cache_stats() -> Dict[str, Any]:
    """
    Get statistics about the current cache state
    
    Returns:
        Dictionary with cache statistics
    """
    stats = {
        'total_items': sum(len(items) for items in _cache.values()),
        'categories': {}
    }
    
    for category, items in _cache.items():
        stats['categories'][category] = {
            'count': len(items),
            'oldest': min([item.get('timestamp', time.time()) for item in items.values()]) if items else None,
            'newest': max([item.get('timestamp', 0) for item in items.values()]) if items else None
        }
    
    return stats
