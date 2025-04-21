// src/pages/CityDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PlacesList from '../components/PlacesList';
import AccommodationWidget from '../components/AccommodationWidget';
import CityImage from '../components/CityImage';
import CityMapView from '../components/CityMapView';
import './CityDetailPage.css';

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
  const navigate = useNavigate();
  const [city, setCity] = useState(null);
  const [placesData, setPlacesData] = useState(null);
  const [accommodationData, setAccommodationData] = useState(null);
  const [occupants, setOccupants] = useState(1);
  const [loading, setLoading] = useState({ 
    city: true, 
    places: true, 
    accommodation: true 
  });
  const [error, setError] = useState({ 
    city: null, 
    places: null, 
    accommodation: null 
  });

  // Fetch city data
  useEffect(() => {
    async function fetchCityData() {
      setLoading(prev => ({ ...prev, city: true }));
      try {
        // Validate cityId format
        if (!cityId || !cityId.includes('_')) {
          throw new Error('Invalid city identifier');
        }

        
        const response = await fetch(`/api/places/${cityId}`);
        
        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 404) {
            throw new Error('City not found');
          }
          throw new Error('Failed to fetch city data');
        }
        
        const data = await response.json();
        
        if (!data || !data.city_name) {
          throw new Error('Invalid city data format');
        }
        
        // Extract city info from places data
        const cityInfo = {
          id: cityId,
          name: data.city_name,
          country: cityId.split('_').pop().toUpperCase() || '', 
          lat: data.latitude || 0,  // Ensure lat is available
          lng: data.longitude || 0  // Ensure lng is available
        };
        
        
        setCity(cityInfo);
        
        // Also set places data since we already have it
        setPlacesData(data);
        setLoading(prev => ({ ...prev, places: false }));
      } catch (err) {
        console.error('City fetch error:', err);
        setError(prev => ({ ...prev, city: err.message }));
        
        // Navigate to error page if city fetch fails
        navigate('/error', { 
          state: { error: err.message },
          replace: true 
        });
      } finally {
        setLoading(prev => ({ ...prev, city: false }));
      }
    }
    
    fetchCityData();
  }, [cityId, navigate]);

  // Fetch accommodation data once we have the city
  useEffect(() => {
    if (!city) {
      
      return;
    }
    
    async function fetchAccommodationData() {
      setLoading(prev => ({ ...prev, accommodation: true }));
      try {
        
        const response = await fetch(`/api/accommodation/${cityId}?occupants=${occupants}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from accommodation API: ${errorText}`);
          throw new Error(`Failed to fetch accommodation data: ${response.status}`);
        }
        
        const data = await response.json();
        
        
        if (!data || !data.accommodations) {
          throw new Error("Invalid accommodation data received from API");
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
            lat={parseFloat(city.lat)} 
            lng={parseFloat(city.lng)} 
            mapboxToken={process.env.REACT_APP_MAPBOX_TOKEN}
          />
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
                
                {/* Buy Me a Coffee Button */}
                <div className="support-container">
                  <p style={{ marginBottom: '1rem', fontSize: '1rem', color: '#2c3e50' }}>
                    Enjoying Remote Radar? Support this project:
                  </p>
                  <a 
                    href="https://buymeacoffee.com/remoteradar" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="coffee-button"
                  >
                    <span style={{ marginRight: '10px' }}>☕</span>
                    Buy me a coffee
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default CityDetailPage;
