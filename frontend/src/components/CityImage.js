// src/components/CityImage.js
import React, { useState, useEffect } from 'react';

function CityImage({ cityName, countryName }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!cityName) {
      setLoading(false);
      return;
    }
    
    const fetchCityImage = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Fetching image for ${cityName}`);
        // You'll need to create this endpoint in your backend
        const response = await fetch(`/api/city-image?city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName || '')}`);
        
        if (!response.ok) {
          console.warn(`Image fetch failed with status: ${response.status}`);
          throw new Error(`Failed to fetch city image: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Image data received:", data);
        setImageData(data);
      } catch (err) {
        console.error('Error fetching city image:', err);
        setError('Could not load city image');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCityImage();
  }, [cityName, countryName]);
  
  // Always return a valid React element, even in loading or error states
  if (loading) {
    return (
      <div className="city-image-container loading">
        <div className="image-loading-placeholder"></div>
      </div>
    );
  }
  
  if (error || !imageData || !imageData.url) {
    // Fallback to a generic city image or show nothing
    return (
      <div className="city-image-container placeholder">
        <div className="city-image-placeholder">
          {error || 'No image available for this city'}
        </div>
      </div>
    );
  }
  
  return (
    <div className="city-image-container">
      <img 
        src={imageData.url} 
        alt={`${cityName}, ${countryName || ''}`}
        className="city-image"
        loading="eager" // This image is important to load quickly
      />
      {imageData.attribution && (
        <div className="city-image-attribution">
          Photo by <a href={imageData.attribution.link} target="_blank" rel="noopener noreferrer">{imageData.attribution.name}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>
        </div>
      )}
    </div>
  );
}

export default CityImage;