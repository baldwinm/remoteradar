// src/components/WeatherWidget.js
import React, { useState, useEffect } from 'react';
import './WeatherWidget.css';

const BACKEND_BASE_URL = 'https://remote-radar-backend.onrender.com';

const WeatherWidget = ({ cityId, units = 'imperial' }) => {
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

  // Render loading state
  if (loading) {
    return (
      <div className="weather-widget loading">
        <div className="loading-spinner"></div>
        <p>Loading weather data...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="weather-widget error">
        <div className="error-icon">⚠️</div>
        <p>Unable to load weather data</p>
        <p className="error-details">{error}</p>
      </div>
    );
  }

  // If no data yet, show a placeholder
  if (!weatherData || !weatherData.weather) {
    return (
      <div className="weather-widget">
        <p>No weather data available for this location</p>
      </div>
    );
  }

  // Extract weather data
  const { weather, city_name } = weatherData;
  const current = weather.current || {};
  const daily = weather.daily || {};
  const hourly = weather.hourly || {};
  
  // Helper to format time (24h to 12h conversion)
  const formatTime = (hour) => {
    const h = parseInt(hour);
    if (isNaN(h)) return hour;
    
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  };
  
  // Helper to get weather icon based on weather code and is_day
  const getWeatherIcon = (code, isDay = true) => {
    // WMO Weather interpretation codes
    // https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
    const iconMap = {
      0: isDay ? '☀️' : '🌙', // Clear sky
      1: isDay ? '🌤️' : '🌙', // Mainly clear
      2: isDay ? '⛅' : '☁️', // Partly cloudy
      3: '☁️',                // Overcast
      45: '🌫️',               // Fog
      48: '🌫️',               // Depositing rime fog
      51: '🌦️',               // Light drizzle
      53: '🌦️',               // Moderate drizzle
      55: '🌧️',               // Dense drizzle
      56: '🌨️',               // Light freezing drizzle
      57: '🌨️',               // Dense freezing drizzle
      61: '🌦️',               // Slight rain
      63: '🌧️',               // Moderate rain
      65: '🌧️',               // Heavy rain
      66: '🌨️',               // Light freezing rain
      67: '🌨️',               // Heavy freezing rain
      71: '🌨️',               // Slight snow fall
      73: '🌨️',               // Moderate snow fall
      75: '❄️',               // Heavy snow fall
      77: '❄️',               // Snow grains
      80: '🌦️',               // Slight rain showers
      81: '🌧️',               // Moderate rain showers
      82: '🌧️',               // Violent rain showers
      85: '🌨️',               // Slight snow showers
      86: '❄️',               // Heavy snow showers
      95: '⛈️',               // Thunderstorm
      96: '⛈️',               // Thunderstorm with slight hail
      99: '⛈️'                // Thunderstorm with heavy hail
    };
    
    return iconMap[code] || '🌥️';
  };
  
  // Helper to get day name from date
  const getDayName = (dateStr) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };
  
  // Helper to get temperature unit
  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const speedUnit = units === 'imperial' ? 'mph' : 'km/h';
  
  // Render current weather
  const renderCurrentWeather = () => (
    <div className="current-weather">
      <div className="weather-now">
        <div className="weather-icon">
          <span role="img" aria-label={`Weather: ${current.weather_description || 'Unknown'}`}>
            {getWeatherIcon(current.weather_code, current.is_day)}
          </span>
        </div>
        <div className="weather-info">
          <div className="temp">{Math.round(current.temperature)}{tempUnit}</div>
          <div className="description">{current.weather_description || 'Unknown conditions'}</div>
          <div className="feels-like">Feels like {Math.round(current.apparent_temperature)}{tempUnit}</div>
        </div>
      </div>
      
      <div className="weather-details">
        <div className="detail-row">
          <div className="detail-item">
            <div className="detail-label">Humidity</div>
            <div className="detail-value">{current.relative_humidity || 'N/A'}%</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Wind</div>
            <div className="detail-value">{Math.round(current.wind_speed_10m || 0)} {speedUnit}</div>
          </div>
        </div>
        <div className="detail-row">
          <div className="detail-item">
            <div className="detail-label">Precipitation</div>
            <div className="detail-value">{current.precipitation || 0} {units === 'imperial' ? 'in' : 'mm'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Cloud Cover</div>
            <div className="detail-value">{current.cloud_cover || 0}%</div>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Render forecast
  const renderForecast = () => (
    <div className="forecast-weather">
      {daily.time && daily.time.map((date, index) => {
        if (index > 2) return null; // Show only next 3 days
        
        return (
          <div className="forecast-day" key={date}>
            <div className="day-name">{getDayName(date)}</div>
            <div className="day-icon">
              <span role="img" aria-label={`Weather: ${daily.weather_description?.[index] || 'Unknown'}`}>
                {getWeatherIcon(daily.weather_code?.[index], true)}
              </span>
            </div>
            <div className="day-temps">
              <span className="high">{Math.round(daily.temperature_2m_max?.[index] || 0)}{tempUnit}</span>
              <span className="low">{Math.round(daily.temperature_2m_min?.[index] || 0)}{tempUnit}</span>
            </div>
            <div className="day-precip">
              <span role="img" aria-label="Precipitation">💧</span>
              <span>{daily.precipitation_probability_max?.[index] || 0}%</span>
            </div>
          </div>
        );
      })}
      
      <div className="extended-forecast-link">
        <a href={`https://www.weather.com/weather/tenday/l/${weatherData.coordinates?.lat},${weatherData.coordinates?.lng}`} target="_blank" rel="noopener noreferrer">
          View Extended Forecast
        </a>
      </div>
    </div>
  );
  
  // Render hourly
  const renderHourly = () => (
    <div className="hourly-weather">
      {hourly.time && hourly.time.slice(0, 24).map((time, index) => {
        // Only show future hours and limit to 24 hours
        const hour = new Date(time).getHours();
        
        return (
          <div className="hourly-item" key={time}>
            <div className="hour-time">{formatTime(hour)}</div>
            <div className="hour-icon">
              <span role="img" aria-label={`Weather: Unknown`}>
                {getWeatherIcon(hourly.weather_code?.[index], hour >= 6 && hour < 20)}
              </span>
            </div>
            <div className="hour-temp">{Math.round(hourly.temperature_2m?.[index] || 0)}{tempUnit}</div>
            <div className="hour-precip">
              <span role="img" aria-label="Precipitation">💧</span>
              <span>{hourly.precipitation_probability?.[index] || 0}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
  
  // Main render
  return (
    <div className="weather-widget">
      <div className="weather-header">
        <h3 className="weather-title">Weather in {city_name}</h3>
        <div className="unit-toggle">
          <button 
            className={units === 'imperial' ? 'active' : ''}
            onClick={() => {
              // Update URL query parameter without page reload
              const url = new URL(window.location.href);
              url.searchParams.set('units', 'imperial');
              window.history.replaceState({}, '', url.toString());
              
              // Reload the component with imperial units
              window.location.reload();
            }}
          >
            °F
          </button>
          <button 
            className={units === 'metric' ? 'active' : ''}
            onClick={() => {
              // Update URL query parameter without page reload
              const url = new URL(window.location.href);
              url.searchParams.set('units', 'metric');
              window.history.replaceState({}, '', url.toString());
              
              // Reload the component with metric units
              window.location.reload();
            }}
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
          className={activeTab === 'forecast' ? 'active' : ''}
          onClick={() => setActiveTab('forecast')}
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
      
      {activeTab === 'current' && renderCurrentWeather()}
      {activeTab === 'forecast' && renderForecast()}
      {activeTab === 'hourly' && renderHourly()}
      
      <div className="weather-footer">
        <div className="attribution">
          Powered by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
