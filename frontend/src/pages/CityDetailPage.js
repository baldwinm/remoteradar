// src/pages/CityDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PlacesList from '../components/PlacesList';
import AccommodationWidget from '../components/AccommodationWidget';
import CityImage from '../components/CityImage';
import WeatherWidget from '../components/WeatherWidget';
import CityMapView from '../components/CityMapView';
import './CityDetailPage.css';
import config from '../config';

// Simple Error Boundary component
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

// City data cache
const cityDataCache = {};

function CityDetailPage() {
  const { cityId } = useParams();
  const [city, setCity] = useState(null);
  const [placesData, setPlacesData] = useState(null);
  const [accommodationData, setAccommodationData] = useState(null);
  const [occupants, setOccupants] = useState(1);
  const [loading, setLoading] = useState({ city: true, places: true, accommodation: true });
  const [error, setError] = useState({ city: null, places: null, accommodation: null });
  const navigate = useNavigate();

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

  // Cache city data in sessionStorage and browsers history state
  useEffect(() => {
    // If we already have city data in the browser history state, use it
    const historyState = window.history.state;
    if (historyState && historyState.cityData && historyState.cityData.id === cityId) {
      console.log("Using city data from history state");
      setCity(historyState.cityData);
      setPlacesData(historyState.placesData);
      setLoading(prev => ({ ...prev, city: false, places: false }));
      return;
    }
    
    // Check if we have cached data in sessionStorage
    const cachedData = sessionStorage.getItem(`city_${cityId}`);
    if (cachedData) {
      try {
        const { cityData, placesData: cachedPlacesData, timestamp } = JSON.parse(cachedData);
        
        // Use cache if it's less than 1 hour old
        if (timestamp && (Date.now() - timestamp) < 3600000) {
          console.log("Using cached city data");
          setCity(cityData);
          setPlacesData(cachedPlacesData);
          setLoading(prev => ({ ...prev, city: false, places: false }));
          
          // Update history state
          window.history.replaceState(
            { cityData, placesData: cachedPlacesData },
            '',
            window.location.pathname + window.location.search
          );
          return;
        }
      } catch (err) {
        console.error("Error parsing cached city data:", err);
        // Continue to fetch fresh data if cache parsing fails
      }
    }
    
    // Fetch fresh data if no cache or cache is expired
    fetchCityData();
  }, [cityId]);

  // Fetch city data
  async function fetchCityData() {
    setLoading(prev => ({ ...prev, city: true }));
    try {
      console.log(`Fetching city data for ${cityId}`);
      const response = await fetch(`/api/places/${cityId}`);
      
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
      
      // Cache the data in sessionStorage
      sessionStorage.setItem(`city_${cityId}`, JSON.stringify({
        cityData: cityInfo,
        placesData: data,
        timestamp: Date.now()
      }));
      
      // Update history state to prevent data loss on back/forward navigation
      window.history.replaceState(
        { cityData: cityInfo, placesData: data },
        '',
        window.location.pathname + window.location.search
      );
    } catch (err) {
      console.error('Error fetching city:', err);
      setError(prev => ({ ...prev, city: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, city: false }));
    }
  }

  // Fetch accommodation data once we have the city
  useEffect(() => {
    if (!city) {
      console.log("Skipping accommodation fetch - no city data yet");
      return;
    }
    
    // Check if we have cached accommodation data
    const cacheKey = `accommodation_${cityId}_${occupants}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { data: accommodationCachedData, timestamp } = JSON.parse(cachedData);
        
        // Use cache if it's less than 1 hour old
        if (timestamp && (Date.now() - timestamp) < 3600000) {
          console.log("Using cached accommodation data");
          setAccommodationData(accommodationCachedData);
          setLoading(prev => ({ ...prev, accommodation: false }));
          return;
        }
      } catch (err) {
        console.error("Error parsing cached accommodation data:", err);
        // Continue to fetch fresh data if cache parsing fails
      }
    }
    
    fetchAccommodationData();
  }, [city, cityId, occupants]);

  async function fetchAccommodationData() {
    setLoading(prev => ({ ...prev, accommodation: true }));
    try {
      console.log(`Fetching accommodation data for ${cityId} with ${occupants} occupants`);
      const response = await fetch(`/api/accommodation/${cityId}?occupants=${occupants}`);
      
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
      
      setAccommodationData(data);
      
      // Cache the accommodation data
      const cacheKey = `accommodation_${cityId}_${occupants}`;
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Error fetching accommodation:', err);
      setError(prev => ({ ...prev, accommodation: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, accommodation: false }));
    }
  }

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
  // Extract country from cityId (last part)
  const cityIdParts = cityId.split('_');
  const countryCode = cityIdParts[cityIdParts.length - 1] || '';
  const countryName = city.country || '';
  
  // If US city, extract state from cityId (second to last part if 3 parts)
  let stateCode = '';
  if (countryCode === 'us' && cityIdParts.length >= 3) {
    stateCode = cityIdParts[cityIdParts.length - 2] || '';
  }
  
  return (
    <ErrorBoundary>
      <div className="city-detail-page">
        <div className="city-header">
          <div className="city-header-content">
            <h1 className="city-name">{cityName}</h1>
            {stateCode && <p className="city-country">{stateCode.toUpperCase()}, {countryName}</p>}
            {!stateCode && countryName && <p className="city-country">{countryName}</p>}
            <Link to="/" className="back-button">← Back to Search</Link>
          </div>
        </div>

        {/* City Image Section */}
        <CityImage cityName={cityName} countryName={countryName} stateCode={stateCode} />

        {/* City Map View Section */}
        <div className="content-row">
          <div className="content-section">
            <CityMapView 
              city={cityName}
              lat={city.lat}
              lng={city.lng}
            />
          </div>
        </div>

        {/* Simple Weather Widget */}
        <div className="content-row">
          <div className="content-section">
            <WeatherWidget 
              cityId={cityId} 
              units={units} 
              onUnitsChange={handleUnitsChange}
              lat={city.lat}
              lng={city.lng}
            />
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
          
          {/* Support/Donation Section */}
          <div className="content-row">
            <div className="content-section">
              <div className="support-container">
                <a href="https://www.buymeacoffee.com/remoteradar" target="_blank" rel="noopener noreferrer" className="coffee-button">
                  ☕ Buy me a coffee
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default CityDetailPage;