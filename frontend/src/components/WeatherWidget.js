// src/components/WeatherWidget.js
import React, { useState, useEffect } from 'react';
import './WeatherWidget.css';
import config from '../config'; // Import config

const WeatherWidget = ({ cityId, units = 'imperial', onUnitsChange, lat, lng }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('current');
  
  console.group('WeatherWidget Initialization');
  console.log('Props received:', { cityId, units, lat, lng });
  console.log('Config:', { 
    API_URL: config.API_URL, 
    env: config.ENVIRONMENT
  });
  console.groupEnd();
  
  useEffect(() => {
    console.group('WeatherWidget Effect');
    console.log('Effect triggered with:', { cityId, units, lat, lng });

    if (!cityId) {
      console.warn('No cityId provided');
      setLoading(false);
      setError('No city ID provided');
      console.groupEnd();
      return;
    }
    
    const fetchWeatherData = async () => {
      console.log('Starting fetchWeatherData');
      setLoading(true);
      setError(null);
      
      try {
        // Construct URL with coordinates if available
        let apiUrl;
        if (lat && lng) {
          // Send coordinates directly in the URL if available
          apiUrl = `${config.API_URL}/api/weather/${cityId}?lat=${lat}&lng=${lng}&units=${units}`;
        } else {
          // Otherwise use the standard endpoint
          apiUrl = `${config.API_URL}/api/weather/${cityId}?units=${units}`;
        }
        
        console.group('Fetch Configuration');
        console.log('Full API URL:', apiUrl);
        console.groupEnd();

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
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
        console.log('Data received:', !!data);
        console.log('Weather data present:', !!(data && data.weather));
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
    
    // Add a small delay to ensure any other component updates finish first
    const timer = setTimeout(() => {
      fetchWeatherData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [cityId, units, lat, lng]);

  // Handle loading state
  if (loading) {
    return (
      <div className="weather-widget loading">
        <div className="loading-spinner"></div>
        <p>Loading weather data...</p>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="weather-widget error">
        <div className="error-icon">⚠️</div>
        <p>Unable to load weather data</p>
        <div className="error-details">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="retry-button"
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Handle no data state
  if (!weatherData || !weatherData.weather) {
    return (
      <div className="weather-widget error">
        <div className="error-icon">⚠️</div>
        <p>No weather data available</p>
      </div>
    );
  }

  const { weather, city_name } = weatherData;
  const { current, daily, hourly } = weather;

  // Helper function to get weather icon
  const getWeatherIcon = (weatherCode) => {
    // Map weather code to icon - simplified example
    const icons = {
      0: '☀️', // Clear sky
      1: '🌤️', // Mainly clear
      2: '⛅', // Partly cloudy
      3: '☁️', // Overcast
      45: '🌫️', // Fog
      48: '🌫️', // Depositing rime fog
      51: '🌦️', // Light drizzle
      53: '🌦️', // Moderate drizzle
      55: '🌦️', // Dense drizzle
      61: '🌧️', // Slight rain
      63: '🌧️', // Moderate rain
      65: '🌧️', // Heavy rain
      71: '🌨️', // Slight snow fall
      73: '🌨️', // Moderate snow fall
      75: '🌨️', // Heavy snow fall
      80: '🌦️', // Slight rain showers
      81: '🌦️', // Moderate rain showers
      82: '🌦️', // Violent rain showers
      95: '⛈️', // Thunderstorm
      96: '⛈️', // Thunderstorm with slight hail
      99: '⛈️', // Thunderstorm with heavy hail
    };
    
    return icons[weatherCode] || '❓';
  };

  // Helper function to format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Helper function to format time
  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Get the current hour's index in the hourly data
  const getCurrentHourIndex = () => {
    if (!hourly || !hourly.time || hourly.time.length === 0) return 0;
    
    const now = new Date();
    for (let i = 0; i < hourly.time.length; i++) {
      const hourTime = new Date(hourly.time[i]);
      if (hourTime >= now) {
        return i;
      }
    }
    return 0;
  };

  // Handle unit toggle
  const handleUnitToggle = (newUnit) => {
    if (newUnit !== units) {
      // Log the unit change
      console.log(`Changing units from ${units} to ${newUnit}`);
      
      // If onUnitsChange prop is provided, call it
      if (onUnitsChange) {
        onUnitsChange(newUnit);
      } else {
        // If no callback provided, log a message
        console.log('No onUnitsChange callback provided');
        
        // Reload the widget with the new units as a fallback
        window.location.href = `${window.location.pathname}?units=${newUnit}`;
      }
    }
  };

  // Get current hour index
  const currentHourIndex = getCurrentHourIndex();

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <h3 className="weather-title">Weather in {city_name}</h3>
        <div className="unit-toggle">
          <button 
            className={units === 'imperial' ? 'active' : ''} 
            onClick={() => handleUnitToggle('imperial')}
          >
            °F
          </button>
          <button 
            className={units === 'metric' ? 'active' : ''} 
            onClick={() => handleUnitToggle('metric')}
          >
            °C
          </button>
        </div>
      </div>
      
      <div className="weather-tabs">
        <button 
          className={activeTab === 'current' ? 'active' : ''} 
          onClick={() => setActiveTab('current')}
        >
          Current
        </button>
        <button 
          className={activeTab === 'daily' ? 'active' : ''} 
          onClick={() => setActiveTab('daily')}
        >
          Forecast
        </button>
        <button 
          className={activeTab === 'hourly' ? 'active' : ''} 
          onClick={() => setActiveTab('hourly')}
        >
          Hourly
        </button>
      </div>
      
      {activeTab === 'current' && current && (
        <div className="current-weather">
          <div className="weather-now">
            <div className="weather-icon">
              {getWeatherIcon(current.weather_code)}
            </div>
            <div className="weather-info">
              <div className="temp">{Math.round(current.temperature)}°{units === 'metric' ? 'C' : 'F'}</div>
              <div className="description">
                {current.weather_description || 'Current conditions'}
              </div>
              <div className="feels-like">
                Feels like {Math.round(current.apparent_temperature)}°{units === 'metric' ? 'C' : 'F'}
              </div>
            </div>
          </div>
          
          <div className="weather-details">
            <div className="detail-row">
              <div className="detail-item">
                <div className="detail-label">Humidity</div>
                <div className="detail-value">{current.relative_humidity}%</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Wind</div>
                <div className="detail-value">
                  {Math.round(current.wind_speed_10m)} {units === 'metric' ? 'km/h' : 'mph'}
                </div>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-item">
                <div className="detail-label">Precipitation</div>
                <div className="detail-value">
                  {current.precipitation} {units === 'metric' ? 'mm' : 'in'}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Pressure</div>
                <div className="detail-value">
                  {current.pressure_msl} hPa
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'daily' && daily && daily.time && (
        <div className="forecast-weather">
          {daily.time.slice(0, 7).map((day, index) => (
            <div className="forecast-day" key={index}>
              <div className="day-name">{formatDate(day)}</div>
              <div className="day-icon">{getWeatherIcon(daily.weather_code[index])}</div>
              <div className="day-temps">
                <span className="high">{Math.round(daily.temperature_2m_max[index])}°</span>
                <span className="low">{Math.round(daily.temperature_2m_min[index])}°</span>
              </div>
              <div className="day-precip">
                💧 {daily.precipitation_probability_max[index]}%
              </div>
            </div>
          ))}
        </div>
      )}
      
      {activeTab === 'hourly' && hourly && hourly.time && (
        <div className="hourly-weather">
          {hourly.time.slice(currentHourIndex, currentHourIndex + 12).map((time, index) => (
            <div className="hourly-item" key={index}>
              <div className="hour-time">{formatTime(time)}</div>
              <div className="hour-icon">{getWeatherIcon(hourly.weather_code[currentHourIndex + index])}</div>
              <div className="hour-temp">{Math.round(hourly.temperature_2m[currentHourIndex + index])}°</div>
              <div className="hour-precip">
                💧 {hourly.precipitation_probability[currentHourIndex + index]}%
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="weather-footer">
        <div className="attribution">
          Data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;