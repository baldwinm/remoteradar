// src/components/RadarMap.js
import React, { useState, useEffect, useRef } from 'react';
import './RadarMap.css';
import config from '../config'; // Import config

// Simple in-memory tile cache to reduce API calls
const tileCache = {};

const RadarMap = ({ lat, lng }) => {
  const [radarData, setRadarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLayer, setCurrentLayer] = useState('precipitation_new'); // Default layer
  const [colorScheme, setColorScheme] = useState(0); // Default color scheme
  const [rateLimitMessage, setRateLimitMessage] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const radarLayerRef = useRef(null);
  const debugMode = true; // Enable debug mode
  const mapInitializedRef = useRef(false); // Track if map has been initialized
  const leafletPluginLoadedRef = useRef(false); // Track if OpenWeatherMap Leaflet plugin is loaded

  // Available OpenWeatherMap layers
  const availableLayers = [
    { id: 'precipitation_new', name: 'Precipitation' },
    { id: 'clouds_new', name: 'Clouds' },
    { id: 'temp_new', name: 'Temperature' },
    { id: 'wind_new', name: 'Wind' },
    { id: 'pressure_new', name: 'Pressure' }
  ];
  
  // Debug logging function
  const debugLog = (...args) => {
    if (debugMode) {
      console.log('[RADAR DEBUG]', ...args);
    }
  };

  // Load necessary scripts
  const loadScripts = () => {
    debugLog("Loading required scripts");

    // Load Leaflet CSS
    const leafletCssExists = document.querySelector('link[href*="leaflet"]');
    if (!leafletCssExists) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
      document.head.appendChild(link);
      debugLog("Leaflet CSS added to head");
    }

    // Load Leaflet JS
    if (typeof window.L === 'undefined') {
      debugLog("Loading Leaflet library");
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
        script.onload = () => {
          debugLog("Leaflet loaded successfully");
          
          // After Leaflet is loaded, load the OpenWeatherMap Leaflet plugin
          const owmScript = document.createElement('script');
          owmScript.src = 'https://unpkg.com/leaflet-openweathermap@1.0.0/leaflet-openweathermap.js';
          owmScript.onload = () => {
            debugLog("OpenWeatherMap Leaflet plugin loaded successfully");
            
            // Add the CSS for the plugin
            const owmCss = document.createElement('link');
            owmCss.rel = 'stylesheet';
            owmCss.href = 'https://unpkg.com/leaflet-openweathermap@1.0.0/leaflet-openweathermap.css';
            document.head.appendChild(owmCss);
            
            leafletPluginLoadedRef.current = true;
            resolve();
          };
          owmScript.onerror = (err) => {
            console.error("Error loading OpenWeatherMap plugin:", err);
            // Even if plugin fails, we can still proceed with basic Leaflet
            resolve();
          };
          document.body.appendChild(owmScript);
        };
        script.onerror = (err) => {
          console.error("Error loading Leaflet:", err);
          setError("Failed to load map library. Please try again later.");
          resolve(); // Resolve anyway so we can show the error
        };
        document.body.appendChild(script);
      });
    } else {
      debugLog("Leaflet already loaded");
      return Promise.resolve();
    }
  };
  
  // Load radar data from backend
  const fetchRadarData = async () => {
    try {
      setLoading(true);
      debugLog("Fetching radar data from backend API...");
      console.log(`API URL: ${config.API_URL}/api/radar/data`);
      
      // Use our backend API endpoint
      const response = await fetch(`${config.API_URL}/api/radar/data`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'include'
      });
      
      debugLog("Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      debugLog("Radar data received:", data);
      
      if (!data.success || !data.radar) {
        throw new Error('Invalid radar data format from API');
      }
      
      setRadarData(data.radar);
    } catch (err) {
      console.error('Error loading radar data:', err);
      setError(`Failed to load radar data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize map when component mounts
  useEffect(() => {
    const initializeMap = async () => {
      debugLog("Initializing map...");
      
      try {
        // Load required scripts
        await loadScripts();
        
        // Initialize the map
        createMap();
        
        // Fetch radar data
        await fetchRadarData();
      } catch (error) {
        console.error("Error during initialization:", error);
        setError(`Failed to initialize map: ${error.message}`);
      }
    };
    
    initializeMap();
    
    // Clean up on unmount
    return () => {
      if (mapInstanceRef.current) {
        debugLog("Cleaning up map on unmount");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitializedRef.current = false;
      }
    };
  }, []);
  
  // Create the map
  const createMap = () => {
    if (!mapRef.current) {
      console.error("Map container not found");
      return;
    }
    
    // Remove existing map if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    
    debugLog("Creating map with container:", mapRef.current);
    debugLog("Container dimensions:", {
      offsetWidth: mapRef.current.offsetWidth,
      offsetHeight: mapRef.current.offsetHeight,
      clientWidth: mapRef.current.clientWidth,
      clientHeight: mapRef.current.clientHeight
    });
    
    try {
      // Ensure the container has a height
      mapRef.current.style.height = '400px';
      mapRef.current.style.width = '100%';
      
      // Create map with explicit container dimensions
      const map = window.L.map(mapRef.current, {
        center: [lat || 39.8283, lng || -98.5795],
        zoom: 5,
        zoomControl: true,
        attributionControl: true
      });
      
      // Add OpenStreetMap tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Weather data &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
        maxZoom: 19
      }).addTo(map);
      
      debugLog("Base map created successfully");
      mapInstanceRef.current = map;
      mapInitializedRef.current = true;
      
      // Force a resize after a short delay
      setTimeout(() => {
        if (mapInstanceRef.current) {
          debugLog("Forcing map resize");
          mapInstanceRef.current.invalidateSize(true);
          
          // Add a marker to confirm map is working
          window.L.marker([lat || 39.8283, lng || -98.5795])
            .addTo(map)
            .bindPopup('Your location')
            .openPopup();
            
          // Add radar layer if data is available
          updateRadarLayer();
        }
      }, 500);
        
    } catch (error) {
      console.error("Error creating map:", error);
      setError(`Failed to initialize map: ${error.message}`);
    }
  };

  // Update when lat/lng props change
  useEffect(() => {
    if (mapInstanceRef.current && mapInitializedRef.current) {
      debugLog("Coordinates changed, updating map center");
      mapInstanceRef.current.setView([lat || 39.8283, lng || -98.5795], 5);
      
      // Add a marker at the new location
      window.L.marker([lat || 39.8283, lng || -98.5795])
        .addTo(mapInstanceRef.current)
        .bindPopup('Your location')
        .openPopup();
    }
  }, [lat, lng]);

  // Update radar layer when currentLayer or radarData changes
  useEffect(() => {
    if (!radarData || !mapInstanceRef.current || !mapInitializedRef.current) {
      debugLog("Skipping radar update - map or data not ready");
      return;
    }
    
    debugLog(`Layer changed to ${currentLayer}, updating radar layer`);
    updateRadarLayer();
  }, [currentLayer, colorScheme, radarData]);

  // Update the radar layer with the current layer selection
  const updateRadarLayer = () => {
    debugLog("updateRadarLayer called");
    
    // Check if we have the map and data
    if (!mapInstanceRef.current || !mapInitializedRef.current) {
      console.error("Cannot update radar layer: Map is not initialized");
      return;
    }
    
    if (!radarData) {
      console.error("Cannot update radar layer: No radar data available");
      return;
    }
    
    // If OpenWeatherMap Leaflet plugin is loaded, use it
    if (leafletPluginLoadedRef.current && window.L.OWM) {
      debugLog("Using OpenWeatherMap Leaflet plugin");
      
      const map = mapInstanceRef.current;
      
      // Remove existing radar layer if it exists
      if (radarLayerRef.current) {
        debugLog("Removing existing radar layer");
        map.removeLayer(radarLayerRef.current);
      }
      
      try {
        // Get API key from environment or use empty string
        const apiKey = process.env.REACT_APP_OWM_API_KEY || '';
        
        // Create the layer with the OpenWeatherMap plugin
        let layer;
        
        switch (currentLayer) {
          case 'precipitation_new':
            layer = window.L.OWM.precipitation({
              appId: apiKey,
              opacity: 0.8,
              showLegend: true
            });
            break;
          case 'clouds_new':
            layer = window.L.OWM.clouds({
              appId: apiKey,
              opacity: 0.8,
              showLegend: true
            });
            break;
          case 'temp_new':
            layer = window.L.OWM.temperature({
              appId: apiKey,
              opacity: 0.8,
              showLegend: true
            });
            break;
          case 'wind_new':
            layer = window.L.OWM.wind({
              appId: apiKey,
              opacity: 0.8,
              showLegend: true
            });
            break;
          case 'pressure_new':
            layer = window.L.OWM.pressure({
              appId: apiKey,
              opacity: 0.8,
              showLegend: true
            });
            break;
          default:
            layer = window.L.OWM.precipitation({
              appId: apiKey,
              opacity: 0.8,
              showLegend: true
            });
        }
        
        // Add layer to map
        layer.addTo(map);
        radarLayerRef.current = layer;
        
      } catch (err) {
        console.error("Error creating radar layer with plugin:", err);
        
        // Fallback to standard tile layer method
        createStandardRadarLayer();
      }
    } else {
      // Use standard tile layer approach
      createStandardRadarLayer();
    }
  };
  
  // Create a standard tile layer for radar
  const createStandardRadarLayer = () => {
    debugLog("Using standard tile layer for radar");
    
    const map = mapInstanceRef.current;
    
    // Remove existing radar layer if it exists
    if (radarLayerRef.current) {
      debugLog("Removing existing radar layer");
      map.removeLayer(radarLayerRef.current);
    }
    
    // Get the host from radar data
    const host = radarData.host || "https://tile.openweathermap.org";
    debugLog("Using host:", host);
    
    try {
      // Create a template URL for the OpenWeatherMap tiles
      // We'll use our backend proxy to handle the API key
      const tileUrlTemplate = `${config.API_URL}/api/radar/tile?` + 
                `host=${encodeURIComponent(host)}` +
                `&path=${encodeURIComponent('/map/' + currentLayer)}` +
                `&x={x}` +
                `&y={y}` +
                `&z={z}` +
                `&color_scheme=${colorScheme}`;
      
      debugLog("Tile URL template:", tileUrlTemplate);
      
      // Create the tile layer
      const tileLayer = window.L.tileLayer(tileUrlTemplate, {
        tileSize: 256,
        opacity: 0.8,
        zIndex: 100,
        maxZoom: 19,
        attribution: 'Weather data &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>'
      });
      
      // Add event handlers for loading/loaded tiles
      tileLayer.on('loading', () => debugLog("Radar tiles loading started"));
      tileLayer.on('load', () => debugLog("Radar tiles loaded"));
      
      tileLayer.on('tileerror', (error) => {
        console.error("Radar tile error:", error);
        
        // Test a direct tile fetch only if not rate limited
        const testUrl = `${config.API_URL}/api/radar/tile?` + 
                     `host=${encodeURIComponent(host)}` +
                     `&path=${encodeURIComponent('/map/' + currentLayer)}` +
                     `&x=0&y=0&z=0` +
                     `&color_scheme=${colorScheme}`;
        
        debugLog("Testing tile URL directly:", testUrl);
        
        fetch(testUrl)
          .then(response => {
            debugLog("Direct tile fetch response:", response.status);
            
            // Check for rate limiting
            if (response.status === 429) {
              console.warn("Rate limit confirmed by direct fetch");
              // Show a brief alert to the user
              setRateLimitMessage("Weather data is temporarily unavailable due to rate limiting. Please wait a moment and try again.");
              setTimeout(() => setRateLimitMessage(null), 5000);
              return null;
            }
            
            return response.blob();
          })
          .then(blob => {
            if (blob) {
              debugLog("Direct tile content:", blob.type, blob.size);
            }
          })
          .catch(err => {
            console.error("Direct tile fetch error:", err);
          });
      });
      
      // Add layer to map
      debugLog("Adding radar layer to map");
      tileLayer.addTo(map);
      radarLayerRef.current = tileLayer;
      
    } catch (err) {
      console.error("Error creating radar layer:", err);
      setError(`Failed to create radar layer: ${err.message}`);
    }
  };

  // Handle layer selection change
  const handleLayerChange = (e) => {
    const newLayer = e.target.value;
    debugLog(`Changing layer from ${currentLayer} to ${newLayer}`);
    setCurrentLayer(newLayer);
  };

  // Format timestamp for display
  const formatTimestamp = () => {
    const date = new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="radar-loading">
        <div className="loading-spinner"></div>
        <p>Loading weather radar data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="radar-error">
        <div className="error-icon">⚠️</div>
        <p>Error loading radar data</p>
        <div className="error-details">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          style={{ marginTop: '10px', padding: '5px 10px' }}
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="radar-component">
      {rateLimitMessage && (
        <div className="radar-rate-limit-warning" style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '10px',
          textAlign: 'center'
        }}>
          {rateLimitMessage}
        </div>
      )}
    
      <div className="radar-controls">
        <div className="radar-timestamp">
          <span className="timestamp-past">
            Current Weather: {formatTimestamp()}
          </span>
        </div>
        
        <div className="radar-options">
          <label htmlFor="layerType">Layer Type: </label>
          <select 
            id="layerType" 
            value={currentLayer} 
            onChange={handleLayerChange}
          >
            {availableLayers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div 
        ref={mapRef} 
        className="radar-map"
        style={{ height: '400px', width: '100%', border: debugMode ? '1px solid red' : 'none' }}
      ></div>
      
      {debugMode && (
        <div className="radar-debug" style={{ marginTop: '10px', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Debug Information</h4>
          <p>Map initialized: {mapInitializedRef.current ? '✅' : '❌'}</p>
          <p>OWM Plugin loaded: {leafletPluginLoadedRef.current ? '✅' : '❌'}</p>
          <p>Radar data: {radarData ? '✅' : '❌'}</p>
          <p>Current layer: {currentLayer}</p>
          <button 
            onClick={() => console.log("Full radar data:", radarData)}
            style={{ marginRight: '10px', padding: '5px 10px' }}
          >
            Log Radar Data
          </button>
          <button 
            onClick={() => {
              if (mapInstanceRef.current) {
                console.log("Forcing map resize");
                mapInstanceRef.current.invalidateSize(true);
                
                // Force reload of the radar layer
                if (radarLayerRef.current) {
                  mapInstanceRef.current.removeLayer(radarLayerRef.current);
                  radarLayerRef.current = null;
                }
                updateRadarLayer();
              } else {
                console.log("Map not initialized, attempting to initialize");
                createMap();
              }
            }}
            style={{ padding: '5px 10px' }}
          >
            Force Map Refresh
          </button>
        </div>
      )}
      
      <div className="radar-info">
        <p className="info-message">
          Radar shows weather conditions from OpenWeatherMap. Select different layers to view precipitation, clouds, temperature, or wind.
        </p>
      </div>
      
      <div className="radar-legend">
        <p className="legend-title">Weather Radar Legend</p>
        <div className="legend-scale">
          <div className="legend-item" style={{ backgroundColor: '#40a4df' }}><span>Light</span></div>
          <div className="legend-item" style={{ backgroundColor: '#0f9d58' }}><span>Moderate</span></div>
          <div className="legend-item" style={{ backgroundColor: '#ffdd57' }}><span>Heavy</span></div>
          <div className="legend-item" style={{ backgroundColor: '#ff5252' }}><span>Severe</span></div>
        </div>
      </div>
    </div>
  );
};

export default RadarMap;
