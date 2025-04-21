// src/components/WeatherDebug.js
import React, { useState, useEffect } from 'react';
import config from '../config';

const WeatherDebug = ({ cityId, units = 'metric', lat, lng }) => {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);

  const runDiagnostic = async () => {
    try {
      setStep(1);
      // Step 1: Verify configuration
      setResults(prev => ({ 
        ...prev, 
        config: {
          API_URL: config.API_URL,
          endpoints: config.endpoints,
          environment: config.ENVIRONMENT
        }
      }));

      // Step 2: Try to fetch city data
      setStep(2);
      const cityUrl = config.endpoints.PLACES(cityId);
      const cityResponse = await fetch(cityUrl);
      const cityData = await cityResponse.json();
      setResults(prev => ({ 
        ...prev, 
        cityRequest: {
          url: cityUrl,
          status: cityResponse.status,
          data: cityData
        }
      }));

      // Step 3: Try a direct weather request
      setStep(3);
      const weatherUrl = `${config.API_URL}/api/weather/${cityId}?units=${units}`;
      const weatherResponse = await fetch(weatherUrl);
      let weatherData;
      try {
        weatherData = await weatherResponse.json();
      } catch (e) {
        weatherData = { parseError: e.toString(), text: await weatherResponse.text() };
      }
      setResults(prev => ({ 
        ...prev, 
        weatherRequest: {
          url: weatherUrl,
          status: weatherResponse.status,
          data: weatherData
        }
      }));

      // Step 4: Check coordinates
      setStep(4);
      let directApiUrl = '';
      if (lat && lng) {
        directApiUrl = `${config.API_URL}/api/weather/${cityId}?lat=${lat}&lng=${lng}&units=${units}`;
        const directResponse = await fetch(directApiUrl);
        const directData = await directResponse.json();
        setResults(prev => ({ 
          ...prev, 
          directRequest: {
            url: directApiUrl,
            status: directResponse.status,
            data: directData
          }
        }));
      } else {
        setResults(prev => ({ 
          ...prev, 
          directRequest: {
            error: "No coordinates available"
          }
        }));
      }

      setStep(5); // Complete
    } catch (err) {
      console.error("Diagnostic error:", err);
      setError(err.toString());
    }
  };

  return (
    <div className="weather-debug" style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3>Weather Widget Diagnostics</h3>
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={runDiagnostic}
          style={{ padding: '0.5rem 1rem', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Run Diagnostic
        </button>
        {error && (
          <div style={{ color: 'red', marginTop: '0.5rem' }}>
            Error: {error}
          </div>
        )}
      </div>
      
      <div style={{ fontSize: '0.9rem' }}>
        <p>Current Step: {step}/5</p>
        <p>City ID: {cityId}</p>
        <p>Units: {units}</p>
        <p>Coordinates: {lat}, {lng}</p>
      </div>
      
      {Object.keys(results).length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Results:</h4>
          <pre style={{ 
            background: '#f1f1f1', 
            padding: '1rem', 
            borderRadius: '4px', 
            maxHeight: '300px', 
            overflow: 'auto', 
            fontSize: '0.8rem' 
          }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default WeatherDebug;
