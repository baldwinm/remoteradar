# services/airbnb.py
import logging
from typing import Dict, Any

# Initialize logger
logger = logging.getLogger(__name__)

def fetch_accommodations(
    city_data: Dict[str, Any],
    api_key: str,
    api_url: str,
    occupants: int = 1,
    cache_ttl: int = 7200
) -> Dict[str, Any]:
    """
    Accommodation data temporarily unavailable while provider is being updated.
    """
    logger.info(f"Accommodation data requested for {city_data.get('name')} - service under maintenance")
    return {
        "city_id": city_data.get('id', ''),
        "city_name": city_data.get('name', ''),
        "average_price": 0,
        "accommodations": [],
        "maintenance": True,
        "message": "Accommodation data is temporarily unavailable while we upgrade our data provider."
    }

def clear_cache() -> None:
    pass

def clean_expired_cache(ttl: int = 7200) -> int:
    return 0
