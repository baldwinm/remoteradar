// src/components/CityImage.js
import React, { useState, useEffect } from 'react';
import './CityImage.css';

function CityImage({ cityName, countryName, state }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Comprehensive diagnostic logging
  console.group('CityImage Component Debug');
  console.log('Rendering with:', { 
    cityName, 
    countryName, 
    state,
    origin: window.location.origin,
    href: window.location.href
  });
  console.groupEnd();
  
  useEffect(() => {
    // Diagnostic logging for effect
    console.group('CityImage Fetch Effect');
    console.log('Effect triggered with:', { cityName, countryName, state });

    // Early exit if no city name
    if (!cityName) {
      console.warn('No city name provided');
      setLoading(false);
      return;
    }
    
    const fetchCityImage = async () => {
      console.log('Starting fetchCityImage');
      setLoading(true);
      setError(null);
      
      try {
        // Construct URL with comprehensive logging
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
        
        setImageData(data);
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
  }, [cityName, countryName, state]);
  
  // Render methods remain the same as in previous version
  // ... (keep existing render logic)

  // Additional error rendering with more diagnostic information
  if (error) {
    return (
      <div className="city-image-container error">
        <div className="city-image-error">
          <p>Unable to load image</p>
          <pre>Error: {error}</pre>
          <pre>
            {JSON.stringify({
              cityName, 
              countryName, 
              state,
              origin: window.location.origin,
              href: window.location.href
            }, null, 2)}
          </pre>
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

  // Rest of the component remains the same
  // ... (keep existing render methods)
}

export default CityImage;
