// src/components/WeatherWidget.js
import React, { useState, useEffect } from 'react';
import './WeatherWidget.css';
import RadarMap from './RadarMap'; // Import the RadarMap component
import LeafletTest from './LeafletTest'; // Import the new test component
import config from '../config'; // Import config

const WeatherWidget = ({ cityId, units = 'imperial', onUnitsChange, lat, lng }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('current');
  // Force imperial units by default if not specified
  const [localUnits, setLocalUnits] = useState(units || 'imperial');
  
  console.group('WeatherWidget Initialization');
  console.log('Props received:', { cityId, units, lat, lng });
  console.log('Config:', { 
    API_URL: config.API_URL, 
    env: config.ENVIRONMENT
  });
  console.groupEnd();
  
  // Update localUnits when units prop changes
  useEffect(() => {
    setLocalUnits(units || 'imperial');
  }, [units]);

  useEffect(() => {
    console.group('WeatherWidget Effect');
    console.log('Effect triggered with:', { cityId, localUnits, lat, lng });

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
          apiUrl = `${config.API_URL}/api/weather/${cityId}?lat=${lat}&lng=${lng}&units=${localUnits}`;
        } else {
          // Otherwise use the standard endpoint
          apiUrl = `${config.API_URL}/api/weather/${cityId}?units=${localUnits}`;
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
  }, [cityId, localUnits, lat, lng]);

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

  const { weather, city_name, coordinates } = weatherData;
  const { current, daily, hourly, air_quality, pollen, alerts } = weather;

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
      85: '🌨️', // Slight snow showers
      86: '🌨️', // Heavy snow showers
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
  const formatTime = (timeStr, isCurrentHour = false) => {
    if (isCurrentHour) {
      return 'Now';
    }
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
    if (newUnit !== localUnits) {
      // Log the unit change
      console.log(`Changing units from ${localUnits} to ${newUnit}`);
      
      // Update local state immediately
      setLocalUnits(newUnit);
      
      // If onUnitsChange prop is provided, call it
      if (onUnitsChange) {
        onUnitsChange(newUnit);
      } else {
        // If no callback provided, log a message
        console.log('No onUnitsChange callback provided');
      }
    }
  };

  // Get current hour index
  const currentHourIndex = getCurrentHourIndex();

  // Function to get AQI level description
  const getAqiLevel = (aqi) => {
    if (!aqi) return 'Unknown';
    if (aqi < 20) return 'Good';
    if (aqi < 40) return 'Fair';
    if (aqi < 60) return 'Moderate';
    if (aqi < 80) return 'Poor';
    if (aqi < 100) return 'Very Poor';
    return 'Hazardous';
  };

  // Function to get pollen level description
  const getPollenLevel = (value) => {
    if (!value) return 'Unknown';
    if (value < 1) return 'None';
    if (value < 2) return 'Low';
    if (value < 3) return 'Moderate';
    if (value < 4) return 'High';
    return 'Very High';
  };

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <h3 className="weather-title">Weather in {city_name}</h3>
        <div className="unit-toggle">
          <button 
            className={localUnits === 'imperial' ? 'active' : ''} 
            onClick={() => handleUnitToggle('imperial')}
          >
            °F
          </button>
          <button 
            className={localUnits === 'metric' ? 'active' : ''} 
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
        {/* Add Radar tab */}
        <button 
          className={activeTab === 'radar' ? 'active' : ''} 
          onClick={() => setActiveTab('radar')}
        >
          Radar
        </button>
        {/* Add this new test tab button */}
        <button 
        className={activeTab === 'test' ? 'active' : ''} 
        onClick={() => setActiveTab('test')}
        >
        Map Test
        </button>		
        {alerts && alerts.length > 0 && (
          <button 
            className={activeTab === 'alerts' ? 'active' : ''} 
            onClick={() => setActiveTab('alerts')}
          >
            Alerts
          </button>
        )}
      </div>
      
      {activeTab === 'current' && current && (
        <div className="current-weather">
          <div className="weather-now">
            <div className="weather-icon">
              {getWeatherIcon(current.weather_code)}
            </div>
            <div className="weather-info">
              <div className="temp">{!isNaN(current.temperature) ? Math.round(current.temperature) : '--'}°{localUnits === 'metric' ? 'C' : 'F'}</div>
              <div className="description">
                {current.weather_description || 'Current conditions'}
              </div>
              <div className="feels-like">
                Feels like {!isNaN(current.apparent_temperature) ? Math.round(current.apparent_temperature) : '--'}°{localUnits === 'metric' ? 'C' : 'F'}
              </div>
            </div>
          </div>
          
          {/* Display sunrise/sunset times */}
          {daily && daily.sunrise && daily.sunset && daily.sunrise.length > 0 && daily.sunset.length > 0 && (
            <div className="sun-times">
              <div className="sun-time">
                <div className="sun-icon">🌅</div>
                <div className="sun-info">
                  <div className="sun-label">Sunrise</div>
                  <div className="sun-value">{formatTime(daily.sunrise[0])}</div>
                </div>
              </div>
              <div className="sun-time">
                <div className="sun-icon">🌇</div>
                <div className="sun-info">
                  <div className="sun-label">Sunset</div>
                  <div className="sun-value">{formatTime(daily.sunset[0])}</div>
                </div>
              </div>
            </div>
          )}
          
          <div className="weather-details">
            <div className="detail-row">
              <div className="detail-item">
                <div className="detail-label">Humidity</div>
                <div className="detail-value">{!isNaN(current.relative_humidity) ? current.relative_humidity : '--'}%</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Wind</div>
                <div className="detail-value">
                  {!isNaN(current.wind_speed_10m) ? Math.round(current.wind_speed_10m) : '--'} {localUnits === 'metric' ? 'km/h' : 'mph'}
                </div>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-item">
                <div className="detail-label">Precipitation</div>
                <div className="detail-value">
                  {!isNaN(current.precipitation) ? current.precipitation : '--'} {localUnits === 'metric' ? 'mm' : 'in'}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Pressure</div>
                <div className="detail-value">
                  {!isNaN(current.pressure_msl) ? current.pressure_msl : '--'} hPa
                </div>
              </div>
            </div>
            
            {/* Add Air Quality Index to regular metrics */}
            {air_quality && air_quality.european_aqi && (
              <div className="detail-row">
                <div className="detail-item">
                  <div className="detail-label">Air Quality Index (AQI)</div>
                  <div className="detail-value">
                    {!isNaN(air_quality.european_aqi) ? air_quality.european_aqi : '--'} - {getAqiLevel(air_quality.european_aqi)}
                  </div>
                </div>
                <div className="detail-item">
                  {/* Intentionally left empty for layout balance */}
                </div>
              </div>
            )}
            
            {/* Pollen Information - simplified and prominent display */}
            {pollen && Object.keys(pollen).length > 0 && (
              <div className="pollen-section">
                <h4 className="section-title">Pollen Levels</h4>
                <div className="pollen-current-levels">
                  {Object.entries(pollen).map(([type, values], index) => (
                    values[0] != null && !isNaN(values[0]) && (
                      <div key={index} className="pollen-item">
                        <div className="pollen-type-label">
                          {type.replace('_pollen', '').charAt(0).toUpperCase() + type.replace('_pollen', '').slice(1)}
                        </div>
                        <div className={`pollen-level-indicator level-${getPollenLevel(values[0]).toLowerCase().replace(' ', '-')}`}>
                          {getPollenLevel(values[0])}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {activeTab === 'daily' && daily && daily.time && (
        <div className="forecast-container">
          {/* Determine the current day's index */}
          {(() => {
            // Get today's date
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time part for proper comparison
            
            // Find index of current day in the forecast data
            let currentDayIndex = 0;
            for (let i = 0; i < daily.time.length; i++) {
              const forecastDate = new Date(daily.time[i]);
              forecastDate.setHours(0, 0, 0, 0);
              
              if (forecastDate.getTime() === today.getTime()) {
                currentDayIndex = i;
                break;
              }
            }
            
            // Get full 12 day forecast if available (today plus next 11)
            const totalDays = Math.min(12, daily.time.length - currentDayIndex);
            const daysToShow = daily.time.slice(currentDayIndex, currentDayIndex + totalDays);
            
            return (
              <>
                {/* First row: days 1-6 */}
                <div className="forecast-weather">
                  {daysToShow.slice(0, 6).map((day, index) => (
                    <div className="forecast-day" key={`first-row-${index}`}>
                      <div className="day-name">{formatDate(day)}</div>
                      <div className="day-icon">{getWeatherIcon(daily.weather_code[currentDayIndex + index])}</div>
                      <div className="day-temps">
                        <span className="high">{!isNaN(daily.temperature_2m_max[currentDayIndex + index]) ? 
                          Math.round(daily.temperature_2m_max[currentDayIndex + index]) : '--'}°</span>
                        <span className="low">{!isNaN(daily.temperature_2m_min[currentDayIndex + index]) ? 
                          Math.round(daily.temperature_2m_min[currentDayIndex + index]) : '--'}°</span>
                      </div>
                      <div className="day-precip">
                        💧 {!isNaN(daily.precipitation_probability_max[currentDayIndex + index]) ? 
                          daily.precipitation_probability_max[currentDayIndex + index] : '--'}%
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Second row: days 7-12 if available */}
                {daysToShow.length > 7 && (
                  <div className="forecast-weather second-row">
                    {daysToShow.slice(7).map((day, index) => (
                      <div className="forecast-day" key={`second-row-${index}`}>
                        <div className="day-name">{formatDate(day)}</div>
                        <div className="day-icon">{getWeatherIcon(daily.weather_code[currentDayIndex + 7 + index])}</div>
                        <div className="day-temps">
                          <span className="high">{!isNaN(daily.temperature_2m_max[currentDayIndex + 7 + index]) ? 
                            Math.round(daily.temperature_2m_max[currentDayIndex + 7 + index]) : '--'}°</span>
                          <span className="low">{!isNaN(daily.temperature_2m_min[currentDayIndex + 7 + index]) ? 
                            Math.round(daily.temperature_2m_min[currentDayIndex + 7 + index]) : '--'}°</span>
                        </div>
                        <div className="day-precip">
                          💧 {!isNaN(daily.precipitation_probability_max[currentDayIndex + 7 + index]) ? 
                            daily.precipitation_probability_max[currentDayIndex + 7 + index] : '--'}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
      
      {activeTab === 'hourly' && hourly && hourly.time && (
        <div className="hourly-weather">
          {/* Show current hour (Now) plus next 23 hours (total 24 hours) */}
          {hourly.time.slice(currentHourIndex, currentHourIndex + 24).map((time, index) => (
            <div className="hourly-item" key={index}>
              <div className="hour-time">{formatTime(time, index === 0)}</div>
              <div className="hour-icon">{getWeatherIcon(hourly.weather_code[currentHourIndex + index])}</div>
              <div className="hour-temp">{!isNaN(hourly.temperature_2m[currentHourIndex + index]) ? 
                Math.round(hourly.temperature_2m[currentHourIndex + index]) : '--'}°</div>
              <div className="hour-precip">
                💧 {!isNaN(hourly.precipitation_probability[currentHourIndex + index]) ? 
                  hourly.precipitation_probability[currentHourIndex + index] : '--'}%
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Add the Radar tab content section */}
      {activeTab === 'radar' && coordinates && (
        <div className="radar-container">
          <RadarMap lat={coordinates.lat} lng={coordinates.lng} />
        </div>
      )}
      {/* New test tab */}
      {activeTab === 'test' && (
        <div className="test-container">
          <LeafletTest />
        </div>
      )}
      {activeTab === 'alerts' && alerts && (
        <div className="alerts-container">
          {alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <div key={index} className={`alert-item alert-${alert.severity}`}>
                <div className="alert-icon">
                  {alert.severity === 'severe' ? '⚠️' : '⚠'}
                </div>
                <div className="alert-content">
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-description">{alert.description}</div>
                  <div className="alert-date">{formatDate(alert.date)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-alerts">
              <p>No weather alerts at this time.</p>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'pollen' && pollen && (
        <div className="pollen-container">
          {/* Keeping this for backward compatibility but users will no longer see this tab */}
          {Object.keys(pollen).length > 0 ? (
            <div className="pollen-forecast">
              <div className="pollen-header">
                <div className="pollen-title">Pollen Forecast</div>
                <div className="pollen-subtitle">Next 5 days</div>
              </div>
              <div className="pollen-types">
                {Object.entries(pollen).map(([type, values]) => (
                  <div key={type} className="pollen-type">
                    <div className="pollen-type-name">{type.replace('_pollen', '').charAt(0).toUpperCase() + type.replace('_pollen', '').slice(1)}</div>
                    <div className="pollen-levels">
                      {values.slice(0, 5).map((value, index) => (
                        <div key={index} className={`pollen-level level-${getPollenLevel(value).toLowerCase().replace(' ', '-')}`}>
                          <div className="pollen-day">{formatDate(daily.time[index])}</div>
                          <div className="pollen-value">{getPollenLevel(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-pollen-data">
              <p>Pollen data is not available for this location.</p>
            </div>
          )}
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