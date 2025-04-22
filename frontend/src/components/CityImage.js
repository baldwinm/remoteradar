// src/components/CityImage.js
import React, { useState, useEffect } from 'react';
import './CityImage.css';

function CityImage({ cityName, countryName, stateCode }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Comprehensive diagnostic logging
  console.group('CityImage Component Debug');
  console.log('Rendering with:', { 
    cityName, 
    countryName, 
    stateCode,
    origin: window.location.origin,
    href: window.location.href
  });
  console.groupEnd();
  
  useEffect(() => {
    // Diagnostic logging for effect
    console.group('CityImage Fetch Effect');
    console.log('Effect triggered with:', { cityName, countryName, stateCode });

    // Early exit if no city name
    if (!cityName) {
      console.warn('No city name provided');
      setLoading(false);
      setError('No city name provided');
      console.groupEnd();
      return;
    }
    
    const fetchCityImage = async () => {
      console.log('Starting fetchCityImage');
      setLoading(true);
      setError(null);
      
      try {
        // Check cache first
        const cacheKey = `cityImage_${cityName}_${stateCode || ''}_${countryName}`;
        const cachedImage = sessionStorage.getItem(cacheKey);
        
        if (cachedImage) {
          try {
            const { imageData, timestamp } = JSON.parse(cachedImage);
            
            // Use cache if it's less than 24 hours old
            if (timestamp && (Date.now() - timestamp) < 86400000) {
              console.log("Using cached city image");
              setImageData(imageData);
              setLoading(false);
              console.groupEnd();
              return;
            }
          } catch (err) {
            console.error("Error parsing cached image data:", err);
            // Continue to fetch fresh data if cache parsing fails
          }
        }
        
        // Build query with state information if available
        let query = cityName;
        
        if (stateCode && (countryName === 'USA' || countryName === 'United States of America' || countryName.toUpperCase() === 'US')) {
          query = `${cityName}, ${stateCode.toUpperCase()}`;
        } else if (countryName) {
          query = `${cityName}, ${countryName}`;
        }
        
        console.log(`Fetching image for: ${query}`);
        
        // Construct URL with comprehensive logging
        const baseUrl = '/api/city-image';
        const params = new URLSearchParams();
        params.append('city', cityName);
        
        if (countryName) {
          params.append('country', countryName);
        }
        
        if (stateCode) {
          params.append('state', stateCode);
        }
        
        const apiUrl = `${baseUrl}?${params.toString()}`;
        
        // Extensive pre-fetch logging
        console.group('Fetch Configuration');
        console.log('Full API URL:', apiUrl);
        console.log('Fetch Configuration:', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': window.location.origin
          },
          mode: 'cors',
          credentials: 'include'
        });
        console.groupEnd();

        // Perform fetch with comprehensive error handling
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': window.location.origin
          },
          mode: 'cors',
          credentials: 'include'
        });

        // Log full response details
        console.group('Fetch Response');
        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
        console.groupEnd();

        // Detailed error handling
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', {
            status: response.status,
            body: errorText
          });
          
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        // Parse and validate response
        const data = await response.json();
        
        console.group('Parsed Image Data');
        console.log('Received Data:', data);
        console.groupEnd();

        // Validate data structure
        if (!data || (!data.url && !data.success)) {
          console.error('Invalid image data format:', data);
          throw new Error("Invalid image data received from API");
        }
        
        // Save to state
        setImageData(data);
        
        // Cache the image data
        sessionStorage.setItem(cacheKey, JSON.stringify({
          imageData: data,
          timestamp: Date.now()
        }));
      } catch (err) {
        // Comprehensive error logging
        console.group('Fetch Error');
        console.error('Detailed Error:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        console.groupEnd();

        setError(err.message || 'Could not load city image');
      } finally {
        setLoading(false);
        console.log('Fetch process completed');
        console.groupEnd(); // Close the initial effect group
      }
    };
    
    fetchCityImage();
  }, [cityName, countryName, stateCode]);
  
  if (loading) {
    return (
      <div className="city-image-container">
        <div className="image-loading-placeholder">Loading city image...</div>
      </div>
    );
  }

  if (error || !imageData) {
    return (
      <div className="city-image-container error">
        <div className="city-image-error">
          <p>Unable to load image for {cityName}</p>
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

  // Determine the image URL from the response
  const imageUrl = imageData.url || imageData.image_url;
  
  if (!imageUrl) {
    return (
      <div className="city-image-container">
        <div className="city-image-placeholder">
          No image available for {cityName}
        </div>
      </div>
    );
  }

  return (
    <div className="city-image-container">
      <img 
        src={imageUrl} 
        alt={`City view of ${cityName}${stateCode ? `, ${stateCode.toUpperCase()}` : ''}`} 
        className="city-image"
        loading="lazy"
      />
      {imageData.attribution && (
        <div className="city-image-attribution">
          {typeof imageData.attribution === 'string' ? (
            imageData.attribution.includes('http') ? (
              <a 
                href={imageData.attribution} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Photo source
              </a>
            ) : (
              <span>{imageData.attribution}</span>
            )
          ) : (
            <a 
              href={imageData.attribution.link || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {imageData.attribution.name || 'Photo by ' + imageData.attribution.username || 'Photo source'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default CityImage;