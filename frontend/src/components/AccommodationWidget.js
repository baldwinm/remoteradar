// src/components/AccommodationWidget.js
import React, { useState, useEffect } from 'react';
import './AccommodationWidget.css';

function AccommodationWidget({ accommodationData }) {
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('price_asc');
  const PROPERTIES_PER_PAGE = 3;

  const sortedAccommodations = React.useMemo(() => {
    if (!accommodationData || !accommodationData.accommodations) {
      return [];
    }

    const { accommodations } = accommodationData;
    const sorted = [...accommodations];

    switch (sortOrder) {
      case 'price_asc':
        return sorted.sort((a, b) => a.price_per_night - b.price_per_night);
      case 'price_desc':
        return sorted.sort((a, b) => b.price_per_night - a.price_per_night);
      case 'rating_desc':
        return sorted.sort((a, b) => {
          const ratingA = typeof a.rating === 'string' ? parseFloat(a.rating) || 0 : a.rating || 0;
          const ratingB = typeof b.rating === 'string' ? parseFloat(b.rating) || 0 : b.rating || 0;
          return ratingB - ratingA;
        });
      default:
        return sorted;
    }
  }, [accommodationData, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortOrder]);

  if (!accommodationData || !accommodationData.accommodations) {
    return (
      <div className="accommodation-container">
        <h3 className="accommodation-title">Accommodation</h3>
        <div className="accommodation-placeholder">
          Accommodation data not available
        </div>
      </div>
    );
  }

  const { average_price } = accommodationData;

  const handleNextImage = (propertyId) => {
    setCurrentImageIndex(prev => {
      const property = sortedAccommodations.find(p => p.id === propertyId);
      const currentIndex = prev[propertyId] || 0;
      const nextIndex = (currentIndex + 1) % (property.images?.length || 1);
      return { ...prev, [propertyId]: nextIndex };
    });
  };

  const handlePrevImage = (propertyId) => {
    setCurrentImageIndex(prev => {
      const property = sortedAccommodations.find(p => p.id === propertyId);
      const currentIndex = prev[propertyId] || 0;
      const imageCount = property.images?.length || 1;
      const newIndex = (currentIndex - 1 + imageCount) % imageCount;
      return { ...prev, [propertyId]: newIndex };
    });
  };

  const totalPages = Math.ceil(sortedAccommodations.length / PROPERTIES_PER_PAGE);
  const paginatedProperties = sortedAccommodations.slice(
    (currentPage - 1) * PROPERTIES_PER_PAGE,
    currentPage * PROPERTIES_PER_PAGE
  );

  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleSortChange = (e) => setSortOrder(e.target.value);

  return (
    <div className="accommodation-container">
      <h3 className="accommodation-title">Accommodation</h3>

      <div className="price-display">
        <div className="price-label">Average Price</div>
        <div className="price-value">
          ${average_price.toFixed(2)}
          <span className="price-unit">/ night</span>
        </div>
      </div>

      <div className="sort-controls">
        <label htmlFor="sort-order">Sort by:</label>
        <select
          id="sort-order"
          value={sortOrder}
          onChange={handleSortChange}
          className="sort-select"
        >
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="rating_desc">Highest Rated</option>
        </select>
      </div>

      <div className="accommodation-list">
        <h4 className="list-header">Available Properties</h4>

        <ul className="property-list">
          {paginatedProperties.map(property => (
            <li key={property.id} className="property-item">
              {property.images && property.images.length > 0 && (
                <div className="property-image-container">
                  <button
                    className="image-nav prev"
                    onClick={() => handlePrevImage(property.id)}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <img
                    src={property.images[currentImageIndex[property.id] || 0]}
                    alt={property.title}
                    className="property-image"
                  />
                  <button
                    className="image-nav next"
                    onClick={() => handleNextImage(property.id)}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <div className="image-counter">
                    {(currentImageIndex[property.id] || 0) + 1}/{property.images.length}
                  </div>
                </div>
              )}

              <div className="property-details">
                <h5 className="property-title">{property.title}</h5>
                {property.property_type && (
                  <div className="property-type">{property.property_type}</div>
                )}

                {property.rating && (
                  <div className="property-rating">
                    <span className="rating-stars">
                      {Array.from({ length: Math.floor(parseFloat(property.rating)) }, (_, i) => (
                        <span key={i} className="star">★</span>
                      ))}
                    </span>
                    <span className="rating-text">{property.rating}</span>
                  </div>
                )}

                {property.rating_word && (
                  <div className="property-rating-word">{property.rating_word}</div>
                )}

                {property.distance_to_center && (
                  <div className="property-distance">{property.distance_to_center}</div>
                )}

                <div className="property-price">
                  ${property.price_per_night.toFixed(2)}/night
                </div>

                <div className="property-badges">
                  {property.is_free_cancellable && (
                    <span className="badge free-cancel">Free cancellation</span>
                  )}
                  {property.has_pool && (
                    <span className="badge pool">Pool</span>
                  )}
                </div>

                {property.web_url && (
                  <div className="property-link-container">
                    <a
                      href={property.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="property-link"
                    >
                      View on Booking.com
                    </a>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-button prev"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-button next"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccommodationWidget;
