// src/pages/CityDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PlacesList from '../components/PlacesList';
import AccommodationWidget from '../components/AccommodationWidget';
import CityImage from '../components/CityImage';
import WeatherWidget from '../components/WeatherWidget';
import WeatherErrorBoundary from '../components/WeatherErrorBoundary';
import WeatherDebug from '../components/WeatherDebug'; // Import debug component
import './CityDetailPage.css';
import config from '../config';

// Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'An unknown error occurred'}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function CityDetailPage() {
  const { cityId } = useParams();
  const [city, setCity] = useState(null);
  const [placesData, setPlacesData] = useState(null);
  const [accommodationData, setAccommodationData] = useState(null);
  const [occupants, setOccupants] = useState(1);
  const [loading, setLoading] = useState({ city: true, places: true, accommodation: true });
  const [error, setError] = useState({ city: null, places: null, accommodation: null });
  const [showDebug, setShowDebug] = useState(false); // State for debug panel
  
  // Get the units parameter from URL query string (default to metric)
  const urlParams = new URLSearchParams(window.location.search);
  const [units, setUnits] = useState(urlParams.get('units') || 'metric');
  
  // Function to handle units change
  const handleUnitsChange = (newUnits) => {
    if (newUnits !== units) {
      setUnits(newUnits);
      
      // Update URL with new units parameter
      const newUrlParams = new URLSearchParams(window.location.search);
      newUrlParams.set('units', newUnits);
      
      // Use replaceState to update URL without causing a page reload
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}?${newUrlParams.toString()}`
      );
    }
  };

  // Log component mounting and the cityId
  console.log("CityDetailPage mounted with cityId:", cityId);

  // Fetch city data
  useEffect(() => {
    async function fetchCityData() {
      setLoading(prev => ({ ...prev, city: true }));
      try {
        console.log(`Fetching city data for ${cityId}`);
        // Use config for API URL
        const response = await fetch(config.endpoints.PLACES(cityId));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from places API: ${errorText}`);
          throw new Error(`Failed to fetch city data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("City data received:", data);
        
        if (!data || !data.city_name) {
          console.error("Invalid places data format:", data);
          throw new Error("Invalid data format received from API");
        }
        
        // Extract city info from places data
        // IMPORTANT: Include lat/lng coordinates from the places data
        const cityInfo = {
          id: cityId,
          name: data.city_name,
          country: cityId.split('_').pop().toUpperCase() || '',
          // Extract coordinates from the first place or from the city data if available
          lat: data.places && data.places.length > 0 ? data.places[0].lat : 0,
          lng: data.places && data.places.length > 0 ? data.places[0].lng : 0
        };
        
        console.log("Setting city state:", cityInfo);
        setCity(cityInfo);
        
        // Also set places data since we already have it
        setPlacesData(data);
        setLoading(prev => ({ ...prev, places: false }));
      } catch (err) {
        console.error('Error fetching city:', err);
        setError(prev => ({ ...prev, city: err.message }));
      } finally {
        setLoading(prev => ({ ...prev, city: false }));
      }
    }
    
    fetchCityData();
  }, [cityId]);

  // Fetch accommodation data once we have the city
  useEffect(() => {
    if (!city) {
      console.log("Skipping accommodation fetch - no city data yet");
      return;
    }
    
    async function fetchAccommodationData() {
      setLoading(prev => ({ ...prev, accommodation: true }));
      try {
        console.log(`Fetching accommodation data for ${cityId} with ${occupants} occupants`);
        // Use config for API URL
        const response = await fetch(config.endpoints.ACCOMMODATION(cityId, occupants));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from accommodation API: ${errorText}`);
          throw new Error(`Failed to fetch accommodation data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Accommodation data received:", data);
        
        if (!data || !data.accommodations) {
          console.error("Invalid accommodation data format:", data);
          throw new Error("Invalid accommodation data received from API");
        }
        
        // Update city coordinates if they're available in the accommodation data
        if (data.accommodations && data.accommodations.length > 0) {
          const firstAccommodation = data.accommodations[0];
          if (firstAccommodation.lat && firstAccommodation.lng) {
            setCity(prev => ({
              ...prev,
              lat: firstAccommodation.lat,
              lng: firstAccommodation.lng
            }));
          }
        }
        
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
  
  // Log the render with city data
  console.log("Rendering CityDetailPage with city:", city);
  
  // Toggle debug panel
  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };
  
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

        {/* Debug button (only in development mode) */}
        {config.DEBUG && (
          <div style={{ textAlign: 'center', margin: '1rem 0' }}>
            <button 
              onClick={toggleDebug}
              style={{ 
                padding: '0.5rem 1rem', 
                background: '#f8f9fa', 
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showDebug ? 'Hide Debug Panel' : 'Show Debug Panel'}
            </button>
          </div>
        )}

        {/* Weather Debug Panel (only shown if showDebug is true) */}
        {config.DEBUG && showDebug && (
          <WeatherDebug 
            cityId={cityId} 
            units={units} 
            lat={city.lat} 
            lng={city.lng} 
          />
        )}

        {/* Weather Widget with Error Boundary */}
        <div className="content-row">
          <div className="content-section">
            <WeatherErrorBoundary>
              {city && city.lat && city.lng ? (
                <WeatherWidget 
                  cityId={cityId} 
                  units={units} 
                  onUnitsChange={handleUnitsChange}
                  lat={city.lat}
                  lng={city.lng}
                />
              ) : (
                <div className="weather-widget error">
                  <div className="error-icon">⚠️</div>
                  <p>Cannot load weather data</p>
                  <div className="error-details">
                    No valid coordinates available for this city
                  </div>
                </div>
              )}
            </WeatherErrorBoundary>
          </div>
        </div>

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
              
              {loading.accommodation ? (
                <div className="section-loading">Loading accommodation data...</div>
              ) : error.accommodation ? (
                <div className="section-error">{error.accommodation}</div>
              ) : (
                <AccommodationWidget accommodationData={accommodationData} />
              )}
            </div>
          
            {/* Places Section */}
            <div className="content-section">
              {loading.places ? (
                <div className="section-loading">Loading places data...</div>
              ) : error.places ? (
                <div className="section-error">{error.places}</div>
              ) : (
                <PlacesList places={placesData?.places || []} />
              )}
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
        </div>

        {/* Add a debug section for coordinates (can be removed in production) */}
        {config.DEBUG && (
          <div className="debug-info">
            <h3>Debug Information</h3>
            <pre>{JSON.stringify({
              cityId,
              coordinates: { lat: city.lat, lng: city.lng },
              units,
              apiUrl: config.API_URL,
              environment: config.ENVIRONMENT
            }, null, 2)}</pre>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default CityDetailPage;