// src/components/CityImage.js
import React, { useState, useEffect } from 'react';
import './CityImage.css';

function CityImage({ cityName, countryName, state }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  console.log("CityImage component rendering with:", { cityName, countryName, state });
  
  useEffect(() => {
    // Only proceed if we have a city name
    if (!cityName) {
      console.log("No city name provided to CityImage component");
      setLoading(false);
      return;
    }
    
    const fetchCityImage = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Construct the full URL with query parameters
        const baseUrl = 'https://remote-radar-backend.onrender.com/api/city-image';
        const params = new URLSearchParams();
        params.append('city', cityName);
        
        if (countryName) {
          params.append('country', countryName);
        }
        
        if (state) {
          params.append('state', state);
        }
        
        const apiUrl = `${baseUrl}?${params.toString()}`;
        console.log(`Fetching city image from: ${apiUrl}`);
        
        // Fetch with comprehensive CORS and error handling
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': 'https://remoteradar.net'
          },
          mode: 'cors',
          credentials: 'include'
        });
        
        // Log the full response for debugging
        console.log('Full response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Check if the response is ok
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from city-image API: ${errorText}`);
          
          // Provide more detailed error information
          throw new Error(`Failed to fetch city image: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        // Parse the JSON
        const data = await response.json();
        console.log("Image data received:", data);
        
        // Validate the data
        if (!data || (!data.url && !data.success)) {
          console.error("Invalid image data format:", data);
          throw new Error("Invalid image data received from API");
        }
        
        setImageData(data);
      } catch (err) {
        console.error('Error fetching city image:', err);
        setError(err.message || 'Could not load city image');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCityImage();
  }, [cityName, countryName, state]);
  
  // Render loading state
  if (loading) {
    return (
      <div className="city-image-container loading">
        <div className="image-loading-placeholder">Loading city image...</div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    console.log("Rendering error state:", error);
    return (
      <div className="city-image-container error">
        <div className="city-image-error">
          <p>Unable to load image</p>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Render no image state
  if (!imageData || (!imageData.url && !imageData.success)) {
    console.log("No image data available");
    return (
      <div className="city-image-container placeholder">
        <div className="city-image-placeholder">
          No image available for {cityName}
          {countryName ? `, ${countryName}` : ''}
        </div>
      </div>
    );
  }
  
  // Determine the correct image URL (prioritize full URL, fallback to smaller sizes)
  const imageUrl = imageData.url || imageData.small_url || imageData.thumb_url;
  
  // Render the image
  console.log("Rendering image:", imageUrl);
  return (
    <div className="city-image-container">
      <img 
        src={imageUrl} 
        alt={`${cityName}${countryName ? `, ${countryName}` : ''}`}
        className="city-image"
        onError={(e) => {
          console.error("Image failed to load:", e);
          setError("Image failed to load");
        }}
      />
      {imageData.attribution && (
        <div className="city-image-attribution">
          Photo by {' '}
          <a href={imageData.attribution.link} target="_blank" rel="noopener noreferrer">
            {imageData.attribution.name}
          </a>
          {' '} via {' '}
          <a href={imageData.attribution.link || "https://mapbox.com"} target="_blank" rel="noopener noreferrer">
            {imageData.attribution.username || 'Mapbox'}
          </a>
        </div>
      )}
    </div>
  );
}

export default CityImage;