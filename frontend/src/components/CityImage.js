// src/components/CityImage.js
import React, { useState, useEffect } from 'react';
import './CityImage.css';

function CityImage({ cityName, countryName }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  console.log("CityImage component rendering with:", { cityName, countryName });
  
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
        // Determine base URL based on environment
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://remote-radar-backend.onrender.com' 
          : '';
        
        // Log the request we're about to make
        console.log(`Fetching image from ${baseUrl}/api/city-image for city: ${cityName}`);
        
        // Make the API request
        const apiUrl = `${baseUrl}/api/city-image?city=${encodeURIComponent(cityName)}${countryName ? `&country=${encodeURIComponent(countryName)}` : ''}`;
        console.log(`API URL: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // Log the response status
        console.log(`Image API response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from city-image API: ${errorText}`);
          throw new Error(`Failed to fetch city image: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Image data received:", data);
        
        if (!data || !data.url) {
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
  }, [cityName, countryName]);
  
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
  if (!imageData || !imageData.url) {
    console.log("No image data available");
    return (
      <div className="city-image-container placeholder">
        <div className="city-image-placeholder">No image available for {cityName}</div>
      </div>
    );
  }
  
  // Render the image
  console.log("Rendering image:", imageData.url);
  return (
    <div className="city-image-container">
      <img 
        src={imageData.url} 
        alt={`${cityName}${countryName ? `, ${countryName}` : ''} map`}
        className="city-image"
        onError={(e) => {
          console.error("Image failed to load:", e);
          setError("Image failed to load");
        }}
      />
      {imageData.attribution && (
        <div className="city-image-attribution">
          Map by {' '}
          <a href={imageData.attribution.link} target="_blank" rel="noopener noreferrer">
            {imageData.attribution.name}
          </a>
        </div>
      )}
    </div>
  );
}

export default CityImage;
