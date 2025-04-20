// src/pages/CityDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PlacesList from '../components/PlacesList';
import AccommodationWidget from '../components/AccommodationWidget';
import CityImage from '../components/CityImage';
import CityMapView from '../components/CityMapView'; // New import
import './CityDetailPage.css';

// ... (keep existing ErrorBoundary component)

function CityDetailPage() {
  const { cityId } = useParams();
  const [city, setCity] = useState(null);
  const [placesData, setPlacesData] = useState(null);
  const [accommodationData, setAccommodationData] = useState(null);
  const [occupants, setOccupants] = useState(1);
  const [loading, setLoading] = useState({ city: true, places: true, accommodation: true });
  const [error, setError] = useState({ city: null, places: null, accommodation: null });

  // ... (keep existing useEffects and other methods)

  // Check if data is still loading
  const isLoading = loading.city;
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading city data...</p>
      </div>
    );
  }

  // Check for critical errors
  if (error.city || !city) {
    return (
      <div className="error-container">
        <h2>Error Loading City</h2>
        <p>{error.city || 'City not found'}</p>
        <Link to="/" className="back-link">Return to Home</Link>
      </div>
    );
  }

  // Get city name for display
  const cityName = city.name || '';
  const countryName = city.country || '';
  
  return (
    <ErrorBoundary>
      <div className="city-detail-page">
        <div className="city-header">
          <div className="city-header-content">
            <h1 className="city-name">{cityName}</h1>
            {countryName && <p className="city-country">{countryName}</p>}
            <Link to="/" className="back-button">← Back to Search</Link>
          </div>
        </div>

        {/* City Image Section */}
        <CityImage cityName={cityName} countryName={countryName} />

        {/* Interactive Map Section */}
        {city.lat && city.lng && (
          <CityMapView 
            city={cityName} 
            lat={city.lat} 
            lng={city.lng} 
            mapboxToken={process.env.REACT_APP_MAPBOX_TOKEN}
          />
        )}

        <div className="city-content">
          {/* ... (rest of the existing content remains the same) */}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default CityDetailPage;