// src/pages/CityDetailPage.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import './CityDetailPage.css';

// Lazy load components to improve initial load time
const PlacesList = lazy(() => import('../components/PlacesList'));
const AccommodationWidget = lazy(() => import('../components/AccommodationWidget'));

// Add a simple debugging component for production
const DebugInfo = ({ info }) => {
  if (process.env.NODE_ENV === 'production' && !window.location.search.includes('debug=true')) {
    return null;
  }
  
  return (
    <div className="debug-info">
      <h3>Debug Information</h3>
      <pre>{JSON.stringify(info, null, 2)}</pre>
    </div>
  );
};

// Simple loading component
const Loading = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading city data...</p>
  </div>
);

function CityDetailPage() {
  const { cityId } = useParams();
  const [city, setCity] = useState(null);
  const [placesData, setPlacesData] = useState(null);
  const [accommodationData, setAccommodationData] = useState(null);
  const [occupants, setOccupants] = useState(1);
  const [loading, setLoading] = useState({ city: true, places: true, accommodation: true });
  const [error, setError] = useState({ city: null, places: null, accommodation: null });
  const [debugInfo, setDebugInfo] = useState(null);
  const [cityImage, setCityImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);

  // Fetch city data
  useEffect(() => {
    console.log("Fetching city data for cityId:", cityId);
    
    async function fetchCityData() {
      setLoading(prev => ({ ...prev, city: true }));
      setError(prev => ({ ...prev, city: null }));
      
      try {
        // Use the full cityId for search
        const response = await fetch(`/api/places/${cityId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Place API error:', errorData);
          throw new Error(errorData.error || 'Failed to fetch city data');
        }
        
        const placesData = await response.json();
        console.log("Places data:", placesData);
        
        if (!placesData || !placesData.city_name) {
          throw new Error('Invalid data format from API');
        }
        
        // Extract city info from places data
        const cityInfo = {
          id: cityId,
          name: placesData.city_name,
          country: '', 
          lat: 0,
          lng: 0
        };
        
        setDebugInfo({
          cityId: cityId,
          queryUsed: `Direct API call to /api/places/${cityId}`,
          placesData: placesData
        });
        
        setCity(cityInfo);
        
        // Also set places data since we already have it
        setPlacesData(placesData);
        setLoading(prev => ({ ...prev, places: false }));
      } catch (err) {
        console.error('Error fetching city:', err);
        setError(prev => ({ ...prev, city: err.message }));
        setDebugInfo({
          cityId: cityId,
          error: err.message,
          errorStack: err.stack
        });
      } finally {
        setLoading(prev => ({ ...prev, city: false }));
      }
    }
    
    fetchCityData();
  }, [cityId]);

  // Fetch city image when we have the city
  useEffect(() => {
    if (!city || !city.name) return;
    
    async function fetchCityImage() {
      setImageLoading(true);
      setImageError(null);
      
      try {
        console.log("Fetching city image for:", city.name);
        const response = await fetch(`/api/city-image?city=${encodeURIComponent(city.name)}`);
        
        if (!response.ok) {
          // Check for specific error status
          if (response.status === 404) {
            console.warn("City image not found");
            setImageError("Image not available");
            return;
          }
          throw new Error(`Failed to fetch city image: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Image data:", data);
        
        if (data && data.url) {
          setCityImage(data);
        } else {
          setImageError("No image data available");
        }
      } catch (err) {
        console.error("Error fetching city image:", err);
        setImageError(err.message);
      } finally {
        setImageLoading(false);
      }
    }
    
    fetchCityImage();
  }, [city]);

  // Fetch accommodation data once we have the city
  useEffect(() => {
    if (!city) return;
    
    async function fetchAccommodationData() {
      setLoading(prev => ({ ...prev, accommodation: true }));
      setError(prev => ({ ...prev, accommodation: null }));
      
      try {
        console.log("Fetching accommodation data");
        const response = await fetch(`/api/accommodation/${cityId}?occupants=${occupants}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch accommodation data');
        }
        
        const data = await response.json();
        console.log("Accommodation data:", data);
        setAccommodationData(data);
      } catch (err) {
        console.error('Error fetching accommodation:', err);
        setError(prev => ({ ...prev, accommodation: err.message }));
      } finally {
        setLoading(prev => ({ ...prev, accommodation: false }));
      }
    }
    
    fetchAccommodationData();
  }, [city, cityId, occupants]);

  // Handle occupants change
  const handleOccupantsChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setOccupants(value);
    }
  };

  // Check if data is still loading
  const isLoading = loading.city;
  
  if (isLoading) {
    return <Loading />;
  }

  // Check for critical errors
  if (error.city || !city) {
    return (
      <div className="error-container">
        <h2>Error Loading City</h2>
        <p>{error.city || 'City not found'}</p>
        <DebugInfo info={debugInfo} />
        <Link to="/" className="back-link">Return to Home</Link>
      </div>
    );
  }

  // Get city, state, and country for display
  const cityName = city.name || '';
  const stateName = city.state || '';
  const countryName = city.country || '';
  
  // Format the location with state (if available)
  const locationSubtitle = stateName 
    ? `${stateName}, ${countryName}` 
    : countryName || 'Loading location...';
  
  return (
    <div className="city-detail-page">
      <div className="city-header">
        <div className="city-header-content">
          <h1 className="city-name">{cityName}</h1>
          <p className="city-country">{locationSubtitle}</p>
          <Link to="/" className="back-button">← Back to Search</Link>
        </div>
      </div>

      {/* City Image Section */}
      {imageLoading ? (
        <div className="city-image-container loading">
          <div className="image-loading-placeholder"></div>
        </div>
      ) : cityImage ? (
        <div className="city-image-container">
          <img 
            src={cityImage.url} 
            alt={`${cityName}, ${countryName || ''}`}
            className="city-image"
            loading="eager"
          />
          {cityImage.attribution && (
            <div className="city-image-attribution">
              Photo by <a href={cityImage.attribution.link} target="_blank" rel="noopener noreferrer">{cityImage.attribution.name}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>
            </div>
          )}
        </div>
      ) : (
        <div className="city-image-container placeholder">
          <div className="city-image-placeholder">
            {imageError ? `Image error: ${imageError}` : 'No image available'}
          </div>
        </div>
      )}

      <div className="city-content">
        <div className="content-row">
          {/* Accommodation Section */}
          <div className="content-section">
            <div className="accommodation-options">
              <label htmlFor="occupants">Occupants:</label>
              <select 
                id="occupants" 
                value={occupants} 
                onChange={handleOccupantsChange}
                className="occupants-select"
              >
                <option value="1">1 person</option>
                <option value="2">2 people</option>
                <option value="3">3 people</option>
                <option value="4">4 people</option>
              </select>
            </div>
            
            <Suspense fallback={<div className="section-loading">Loading accommodation data...</div>}>
              {loading.accommodation ? (
                <div className="section-loading">Loading accommodation data...</div>
              ) : error.accommodation ? (
                <div className="section-error">
                  <p>Error loading accommodation data: {error.accommodation}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="retry-button"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <AccommodationWidget accommodationData={accommodationData} />
              )}
            </Suspense>
          </div>
        
          {/* Places Section */}
          <div className="content-section">
            <Suspense fallback={<div className="section-loading">Loading places data...</div>}>
              {loading.places ? (
                <div className="section-loading">Loading places data...</div>
              ) : error.places ? (
                <div className="section-error">
                  <p>Error loading places data: {error.places}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="retry-button"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <PlacesList places={placesData?.places || []} />
              )}
            </Suspense>
          </div>
        </div>
        
        {/* City Summary */}
        <div className="content-row">
          <div className="content-section">
            <div className="city-summary">
              <h3>About {cityName}</h3>
              <div className="summary-stats">
                <div className="stat-item">
                  <div className="stat-icon">🏨</div>
                  <div className="stat-value">
                    ${accommodationData?.average_price?.toFixed(2) || '0.00'}
                  </div>
                  <div className="stat-label">Avg. Nightly</div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">☕</div>
                  <div className="stat-value">
                    {placesData?.counts?.coffee || 0}
                  </div>
                  <div className="stat-label">Coffee Shops</div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">💻</div>
                  <div className="stat-value">
                    {placesData?.counts?.coworking || 0}
                  </div>
                  <div className="stat-label">Coworking Spaces</div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">🍽️</div>
                  <div className="stat-value">
                    {placesData?.counts?.restaurant || 0}
                  </div>
                  <div className="stat-label">Restaurants</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Debug info section - only visible in development or with ?debug=true */}
        <DebugInfo info={{
          city,
          imageData: cityImage,
          imageError,
          apiCalls: {
            city: `/api/places/${cityId}`,
            image: `/api/city-image?city=${encodeURIComponent(city.name)}`,
            accommodation: `/api/accommodation/${cityId}?occupants=${occupants}`
          },
          errors: error
        }} />
      </div>
    </div>
  );
}

export default CityDetailPage;