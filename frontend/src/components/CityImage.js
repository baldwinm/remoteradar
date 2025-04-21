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
        // Construct the API URL with all available parameters
        const params = new URLSearchParams({
          city: cityName,
          ...(countryName && { country: countryName }),
          ...(state && { state: state })
        });
        
        const apiUrl = `/api/city-image?${params.toString()}`;
        console.log(`Fetching city image from: ${apiUrl}`);
        
        // Explicitly set credentials
        const response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://remoteradar.net'
          }
        });
        
        // Log the response status
        console.log(`City image API response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from city-image API: ${errorText}`);
          throw new Error(`Failed to fetch city image: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Image data received:", data);
        
        // Handle different response formats
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