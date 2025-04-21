// src/components/WeatherWidget.js
import React, { useState, useEffect } from 'react';
import './WeatherWidget.css';

const BACKEND_BASE_URL = 'https://remote-radar-backend.onrender.com';

const WeatherWidget = ({ cityId, units = 'metric' }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('current');
  
  console.group('WeatherWidget Initialization');
  console.log('Props received:', { cityId, units });
  console.log('Backend Base URL:', BACKEND_BASE_URL);
  console.groupEnd();
  
  useEffect(() => {
    console.group('WeatherWidget Effect');
    console.log('Effect triggered with:', { cityId, units });

    if (!cityId) {
      console.warn('No cityId provided');
      setLoading(false);
      return;
    }
    
    const fetchWeatherData = async () => {
      console.log('Starting fetchWeatherData');
      setLoading(true);
      setError(null);
      
      try {
        const apiUrl = `${BACKEND_BASE_URL}/api/weather/${cityId}?units=${units}`;
        
        console.group('Fetch Configuration');
        console.log('Full API URL:', apiUrl);
        console.groupEnd();

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': window.location.origin
          },
          mode: 'cors',
          credentials: 'include'
        });

        console.group('Fetch Response');
        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
        console.groupEnd();

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', {
            status: response.status,
            body: errorText
          });
          
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const data = await response.json();
        
        console.group('Parsed Weather Data');
        console.log('Received Data:', JSON.stringify(data, null, 2));
        console.groupEnd();

        if (!data || !data.weather) {
          console.error('Invalid weather data format:', data);
          throw new Error("Invalid weather data received from API");
        }
        
        setWeatherData(data);
      } catch (err) {
        console.group('Fetch Error');
        console.error('Detailed Error:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        console.groupEnd();

        setError(err.message || 'Could not load weather data');
      } finally {
        setLoading(false);
        console.log('Fetch process completed');
        console.groupEnd();
      }
    };
    
    fetchWeatherData();
  }, [cityId, units]);

  // Rest of the component remains the same as your original implementation
  // ... (keep existing render methods)
}

export default WeatherWidget;
