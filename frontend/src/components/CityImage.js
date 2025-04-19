// src/components/CityImage.js - Optimized Version
import React, { useState, useEffect } from 'react';

function CityImage({ cityName, countryName }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  useEffect(() => {
    if (!cityName) return;
    
    const fetchCityImage = async () => {
      setLoading(true);
      setError(null);
      setIsImageLoaded(false);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(
          `/api/city-image?city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName || '')}`,
          { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error('Failed to fetch city image');
        }
        
        const data = await response.json();
        setImageData(data);
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error('Image fetch timed out');
          setError('Image request timed out');
        } else {
          console.error('Error fetching city image:', err);
          setError('Could not load city image');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchCityImage();
  }, [cityName, countryName]);
  
  const handleImageLoad = () => {
    setIsImageLoaded(true);
  };
  
  if (loading) {
    return (
      <div className="city-image-container loading">
        <div className="image-loading-placeholder"></div>
      </div>
    );
  }
  
  if (error || !imageData || !imageData.url) {
    // Fallback to a generic city image or show nothing
    return null;
  }
  
  // Progressive loading approach - first load small thumbnail, then full image
  return (
    <div className="city-image-container">
      <picture>
        {/* If the browser supports webp, use it for better performance */}
        {imageData.thumb_url && (
          <source
            srcSet={imageData.thumb_url}
            type="image/webp"
            media="(max-width: 500px)"
          />
        )}
        {imageData.small_url && (
          <source
            srcSet={imageData.small_url}
            type="image/webp"
            media="(max-width: 800px)"
          />
        )}
        <img 
          src={imageData.url} 
          alt={`${cityName}, ${countryName || ''}`}
          className={`city-image ${isImageLoaded ? 'loaded' : ''}`}
          loading="eager" // This image is important to load quickly
          onLoad={handleImageLoad}
        />
      </picture>
      
      {!isImageLoaded && imageData.thumb_url && (
        <img 
          src={imageData.thumb_url}
          alt=""
          className="city-image-placeholder"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            filter: 'blur(10px)',
            objectFit: 'cover',
            opacity: 0.7,
          }}
        />
      )}
      
      {imageData.attribution && (
        <div className="city-image-attribution">
          Photo by <a href={imageData.attribution.link} target="_blank" rel="noopener noreferrer">{imageData.attribution.name}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>
        </div>
      )}
    </div>
  );
}

export default CityImage;