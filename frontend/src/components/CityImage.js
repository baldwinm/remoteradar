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
        
        // More robust fetch configuration
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': 'https://remoteradar.net'
          },
          credentials: 'include'  // Important for CORS with credentials
        });

        // Detailed logging of response
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Check if the response is ok
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from city-image API: ${errorText}`);
          
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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
        console.error('Detailed fetch error:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        setError(err.message || 'Could not load city image');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCityImage();
  }, [cityName, countryName, state]);
  
  // Rest of the component remains the same as in your original implementation
  // ... (keep the existing render methods)
}

export default CityImage;
