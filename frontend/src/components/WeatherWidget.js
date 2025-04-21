// src/components/WeatherWidget.js
import React, { useState, useEffect } from 'react';
import './WeatherWidget.css';

const WeatherWidget = ({ cityId, units = 'metric' }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('current');
  
  useEffect(() => {
    const fetchWeatherData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/weather/${cityId}?units=${units}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch weather data: ${response.status}`);
        }
        
        const data = await response.json();
        setWeatherData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching weather data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWeatherData();
  }, [cityId, units]);

  // Helper function to get the appropriate temperature unit
  const getTempUnit = () => units === 'metric' ? '°C' : '°F';
  
  // Helper function to get wind speed unit
  const getWindUnit = () => units === 'metric' ? 'm/s' : 'mph';
  
  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  
  // Helper function to format time
  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  
  // Helper function to generate Open-Meteo icon URL
  const getOpenMeteoIcon = (weatherCode, isDay = true) => {
    const dayNight = isDay ? 'day' : 'night';
    return `https://cdn.open-meteo.com/images/wmo-codes/${weatherCode}_${dayNight}.svg`;
  };
  
  if (loading) {
    return (
      <div className="weather-widget loading">
        <div className="loading-spinner"></div>
        <p>Loading weather data...</p>
      </div>
    );
  }

  if (error || !weatherData || !weatherData.weather || !weatherData.weather.current) {
    return (
      <div className="weather-widget error">
        <div className="error-icon">⚠️</div>
        <p>Unable to load weather data</p>
        <p className="error-details">{error || 'Unknown error'}</p>
      </div>
    );
  }

  const { current, daily, hourly } = weatherData.weather;
  
  return (
    <div className="weather-widget">
      <div className="weather-header">
        <h3 className="weather-title">Weather</h3>
        <div className="unit-toggle">
          <button 
            className={units === 'metric' ? 'active' : ''} 
            onClick={() => window.location.href = `/city/${cityId}?units=metric`}
          >
            °C
          </button>
          <button 
            className={units === 'imperial' ? 'active' : ''} 
            onClick={() => window.location.href = `/city/${cityId}?units=imperial`}
          >
            °F
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
      
      <div className="weather-content">
        {activeTab === 'current' && (
          <div className="current-weather">
            <div className="weather-now">
              <div className="weather-icon">
                <img 
                  src={getOpenMeteoIcon(current.weather_code, current.is_day)} 
                  alt={current.weather} 
                />
              </div>
              <div className="weather-info">
                <div className="temp">{Math.round(current.temp)}{getTempUnit()}</div>
                <div className="description">{current.description}</div>
                <div className="feels-like">Feels like {Math.round(current.feels_like)}{getTempUnit()}</div>
              </div>
            </div>
            
            <div className="weather-details">
              <div className="detail-row">
                <div className="detail-item">
                  <span className="detail-label">Humidity</span>
                  <span className="detail-value">{current.humidity}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Wind</span>
                  <span className="detail-value">{Math.round(current.wind_speed)} {getWindUnit()}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-item">
                  <span className="detail-label">Clouds</span>
                  <span className="detail-value">{current.clouds}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Pressure</span>
                  <span className="detail-value">{current.pressure} hPa</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'forecast' && (
          <div className="forecast-weather">
            {daily.map((day, index) => (
              <div key={index} className="forecast-day">
                <div className="day-name">{index === 0 ? 'Today' : day.day_name}</div>
                <div className="day-icon">
                  <img 
                    src={getOpenMeteoIcon(day.weather_code, true)} 
                    alt={day.condition} 
                  />
                </div>
                <div className="day-temps">
                  <span className="high">{Math.round(day.temp_max)}{getTempUnit()}</span>
                  <span className="low">{Math.round(day.temp_min)}{getTempUnit()}</span>
                </div>
                <div className="day-condition">{day.condition}</div>
                <div className="day-precip">
                  <span className="precip-icon">💧</span>
                  <span className="precip-prob">{day.precipitation_probability}%</span>
                </div>
              </div>
            ))}
            
            <div className="extended-forecast-link">
              <a 
                href="https://open-meteo.com/" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                View Extended Forecast →
              </a>
            </div>
          </div>
        )}
        
        {activeTab === 'hourly' && (
          <div className="hourly-weather">
            {hourly.map((hour, index) => (
              <div key={index} className="hourly-item">
                <div className="hour-time">{formatTime(hour.timestamp)}</div>
                <div className="hour-icon">
                  <img 
                    src={getOpenMeteoIcon(hour.weather_code, hour.is_day)} 
                    alt={hour.condition} 
                  />
                </div>
                <div className="hour-temp">{Math.round(hour.temp)}{getTempUnit()}</div>
                <div className="hour-precip">
                  <span className="precip-icon">💧</span>
                  <span className="precip-prob">{hour.precipitation_probability}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="weather-footer">
        <p className="attribution">
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        </p>
      </div>
    </div>
  );
};

export default WeatherWidget;