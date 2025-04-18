// src/pages/CityDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PlacesList from '../components/PlacesList';
import AccommodationWidget from '../components/AccommodationWidget';
import './CityDetailPage.css';

function CityDetailPage() {
  const { cityId } = useParams();
  const [city, setCity] = useState(null);
  const [placesData, setPlacesData] = useState(null);
  const [accommodationData, setAccommodationData] = useState(null);
  const [occupants, setOccupants] = useState(1);
  const [loading, setLoading] = useState({ city: true, places: true, accommodation: true });
  const [error, setError] = useState({ city: null, places: null, accommodation: null });
  const [debugInfo, setDebugInfo] = useState(null);

  // Fetch city data
  useEffect(() => {
    async function fetchCityData() {
      setLoading(prev => ({ ...prev, city: true }));
      try {
        // Use the full cityId for search
        
        const response = await fetch(`/api/places/${cityId}`);
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Place API error:', errorData);
          throw new Error('Failed to fetch city data');
        }
        
        const placesData = await response.json();
        
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

  // Fetch places data once we have the city
  useEffect(() => {
    if (!city) return;
    
    async function fetchPlacesData() {
      setLoading(prev => ({ ...prev, places: true }));
      try {
        const response = await fetch(`/api/places/${cityId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch places data');
        }
        
        const data = await response.json();
        setPlacesData(data);
      } catch (err) {
        console.error('Error fetching places:', err);
        setError(prev => ({ ...prev, places: err.message }));
      } finally {
        setLoading(prev => ({ ...prev, places: false }));
      }
    }
    
    fetchPlacesData();
  }, [city, cityId]);

  // Fetch accommodation data once we have the city
  useEffect(() => {
    if (!city) return;
    
    async function fetchAccommodationData() {
      setLoading(prev => ({ ...prev, accommodation: true }));
      try {
        const response = await fetch(`/api/accommodation/${cityId}?occupants=${occupants}`);
        if (!response.ok) {
          throw new Error('Failed to fetch accommodation data');
        }
        
        const data = await response.json();
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
        {debugInfo && (
          <div style={{ marginTop: '20px', textAlign: 'left', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
            <h3>Debug Information:</h3>
            <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
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
    : countryName;
  
  return (
    <div className="city-detail-page">
      <div className="city-header">
        <div className="city-header-content">
          <h1 className="city-name">{cityName}</h1>
          <p className="city-country">{locationSubtitle}</p>
          <Link to="/" className="back-button">← Back to Search</Link>
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
                    ${accommodationData?.average_price.toFixed(2) || '0.00'}
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
    </div>
  );
}

export default CityDetailPage;