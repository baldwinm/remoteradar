// src/components/PlacesList.js
import React, { useState, useEffect, useCallback } from 'react';
import './PlacesList.css';

function PlacesList({ places }) {
  const [currentFilter, setCurrentFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [placeDetails, setPlaceDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const PLACES_PER_PAGE = 5; // Set to show 5 items per page
  
  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [currentFilter, priceFilter]);
  
  // Fetch place details function - will be used for lazy loading
  const fetchPlaceDetails = useCallback(async (placeId) => {
    // Check if we already have details for this place
    if (placeDetails[placeId]) return;
    
    try {
      setLoadingDetails(true);
      
      // If needed, implement a route to fetch just the details for a single place
      // This is a simplified example, you may need to adapt it to your API
      /* 
      const response = await fetch(`/api/place-details/${placeId}`);
      if (response.ok) {
        const data = await response.json();
        setPlaceDetails(prev => ({
          ...prev,
          [placeId]: data
        }));
      }
      */
      
      // For now, we'll just mark it as loaded
      setPlaceDetails(prev => ({
        ...prev,
        [placeId]: { loaded: true }
      }));
    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setLoadingDetails(false);
    }
  }, [placeDetails]);
  
  if (!places || places.length === 0) {
    return (
      <div className="places-container">
        <div className="places-header">
          <h3>Local Amenities</h3>
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${currentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-tab ${currentFilter === 'coffee' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('coffee')}
            >
              Coffee
            </button>
            <button 
              className={`filter-tab ${currentFilter === 'coworking' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('coworking')}
            >
              Coworking
            </button>
            <button 
              className={`filter-tab ${currentFilter === 'restaurant' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('restaurant')}
            >
              Restaurants
            </button>
          </div>
        </div>
        <p className="no-places-message">No places found for this location.</p>
      </div>
    );
  }
  
  // Filter places based on current filter
  let filteredPlaces = currentFilter === 'all' 
    ? places 
    : places.filter(place => place.type === currentFilter);
  
  // Apply price filter for restaurants
  if (currentFilter === 'restaurant' && priceFilter !== 'all') {
    const priceLevel = parseInt(priceFilter);
    filteredPlaces = filteredPlaces.filter(place => 
      place.price_level === priceLevel
    );
  }
  
  // Sort places by rating (highest first)
  const sortedPlaces = [...filteredPlaces].sort((a, b) => b.rating - a.rating);
  
  // Apply pagination
  const totalPages = Math.ceil(sortedPlaces.length / PLACES_PER_PAGE);
  const paginatedPlaces = sortedPlaces.slice(
    (currentPage - 1) * PLACES_PER_PAGE,
    currentPage * PLACES_PER_PAGE
  );
  
  // Get icon based on place type
  const getPlaceIcon = (type) => {
    switch (type) {
      case 'coffee':
        return '☕';
      case 'coworking':
        return '💻';
      case 'restaurant':
        return '🍽️';
      default:
        return '📍';
    }
  };
  
  // Get price level display for restaurants
  const getPriceLevel = (level) => {
    if (level === undefined || level === null) return '';
    
    switch (level) {
      case 0:
        return 'Free';
      case 1:
        return '$';
      case 2:
        return '$$';
      case 3:
        return '$$$';
      case 4:
        return '$$$$';
      default:
        return '';
    }
  };
  
  // Handle pagination
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };
  
  return (
    <div className="places-container">
      <div className="places-header">
        <h3>Local Amenities</h3>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${currentFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${currentFilter === 'coffee' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('coffee')}
          >
            Coffee
          </button>
          <button 
            className={`filter-tab ${currentFilter === 'coworking' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('coworking')}
          >
            Coworking
          </button>
          <button 
            className={`filter-tab ${currentFilter === 'restaurant' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('restaurant')}
          >
            Restaurants
          </button>
        </div>
        
        {/* Price filter for restaurants */}
        {currentFilter === 'restaurant' && (
          <div className="price-filter-container">
            <div className="price-filter-label">Budget:</div>
            <div className="price-filter-buttons">
              <button 
                className={`price-filter-btn ${priceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPriceFilter('all')}
              >
                All
              </button>
              <button 
                className={`price-filter-btn ${priceFilter === '1' ? 'active' : ''}`}
                onClick={() => setPriceFilter('1')}
              >
                $
              </button>
              <button 
                className={`price-filter-btn ${priceFilter === '2' ? 'active' : ''}`}
                onClick={() => setPriceFilter('2')}
              >
                $$
              </button>
              <button 
                className={`price-filter-btn ${priceFilter === '3' ? 'active' : ''}`}
                onClick={() => setPriceFilter('3')}
              >
                $$$
              </button>
              <button 
                className={`price-filter-btn ${priceFilter === '4' ? 'active' : ''}`}
                onClick={() => setPriceFilter('4')}
              >
                $$$$
              </button>
            </div>
          </div>
        )}
      </div>
      
      {filteredPlaces.length === 0 ? (
        <p className="no-places-message">
          {currentFilter === 'restaurant' && priceFilter !== 'all' 
            ? `No restaurants found with price level ${getPriceLevel(parseInt(priceFilter))}.` 
            : "No places found for the selected filter."}
        </p>
      ) : (
        <>
          <div className="results-info">
            <p>Found {filteredPlaces.length} places</p>
          </div>
          
          <ul className="places-list">
            {paginatedPlaces.map((place) => (
              <li key={place.id} className="place-item">
                <div className="place-icon">
                  {getPlaceIcon(place.type)}
                </div>
                <div className="place-details">
                  <div className="place-header">
                    <h4 className="place-name">
                      {place.website ? (
                        <a href={place.website} target="_blank" rel="noopener noreferrer" className="place-link">
                          {place.name}
                        </a>
                      ) : place.maps_url ? (
                        <a href={place.maps_url} target="_blank" rel="noopener noreferrer" className="place-link">
                          {place.name}
                        </a>
                      ) : (
                        place.name
                      )}
                    </h4>
                    {place.type === 'restaurant' && place.price_level !== undefined && (
                      <span className="price-level">{getPriceLevel(place.price_level)}</span>
                    )}
                  </div>
                  <p className="place-address">{place.address}</p>
                  <div className="place-rating">
                    <span className="stars">
                      {Array.from({ length: Math.floor(place.rating) }, (_, i) => (
                        <span key={i} className="star">★</span>
                      ))}
                      {place.rating % 1 >= 0.5 && <span className="star-half">★</span>}
                    </span>
                    <span className="rating-value">{place.rating.toFixed(1)}</span>
                    {place.user_ratings_total > 0 && (
                      <span className="rating-count">({place.user_ratings_total})</span>
                    )}
                  </div>
                  
                  {/* Place links */}
                  <div className="place-links">
                    {place.phone && (
                      <a href={`tel:${place.phone.replace(/[^\d+]/g, '')}`} className="place-phone-link">
                        {place.phone}
                      </a>
                    )}
                    
                    <div className="external-links">
                      {place.website && (
                        <a href={place.website} target="_blank" rel="noopener noreferrer" className="external-link website-link">
                          Website
                        </a>
                      )}
                      {place.maps_url && (
                        <a href={place.maps_url} target="_blank" rel="noopener noreferrer" className="external-link maps-link">
                          View on Maps
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                className="pagination-button prev" 
                onClick={() => handlePageChange(currentPage - 1)} 
                disabled={currentPage === 1}
              >
                Previous
              </button>
              
              <div className="pagination-numbers">
                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index + 1}
                    className={`pagination-number ${currentPage === index + 1 ? 'active' : ''}`}
                    onClick={() => handlePageChange(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              
              <button 
                className="pagination-button next" 
                onClick={() => handlePageChange(currentPage + 1)} 
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PlacesList;