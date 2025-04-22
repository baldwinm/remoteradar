import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './CityMapView.css';

// Define a fallback token - only for development purposes
// In production, you should always use environment variables
const FALLBACK_TOKEN = "YOUR_FALLBACK_TOKEN"; // Replace this with your actual token if needed

const CityMapView = ({ 
  city, 
  lat, 
  lng 
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [zoom, setZoom] = useState(12);
  const [style, setStyle] = useState('streets-v11');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Mapbox styles available
  const mapStyles = [
    { id: 'streets-v11', name: 'Street Map' },
    { id: 'satellite-v9', name: 'Satellite' },
    { id: 'satellite-streets-v11', name: 'Satellite with Streets' },
    { id: 'light-v10', name: 'Light' },
    { id: 'dark-v10', name: 'Dark' },
    { id: 'outdoors-v11', name: 'Outdoors' }
  ];

  // Initialize the map
  useEffect(() => {
    // Skip if no container or coordinates
    if (!mapContainer.current || !lat || !lng) return;
    
    // Skip if map already initialized
    if (map.current) return;
    
    // Debug logs
    console.log("Initializing map with coordinates:", lat, lng);
    
    // Try various ways to get the Mapbox token
    // 1. First try window._env_ (sometimes used for runtime env vars)
    // 2. Then try process.env
    // 3. Finally use fallback token if all else fails
    let token;
    
    // Try window._env_ first (used in some React setups for runtime env vars)
    if (window._env_ && window._env_.REACT_APP_MAPBOX_TOKEN) {
      token = window._env_.REACT_APP_MAPBOX_TOKEN;
      console.log("Using token from window._env_");
    }
    // Then try process.env
    else if (process.env.REACT_APP_MAPBOX_TOKEN) {
      token = process.env.REACT_APP_MAPBOX_TOKEN;
      console.log("Using token from process.env");
    }
    // Finally use fallback token
    else {
      token = FALLBACK_TOKEN;
      console.log("Using fallback token");
    }
    
    // Check if token is valid
    if (!token || token === "YOUR_FALLBACK_TOKEN") {
      console.error("Mapbox token is missing or invalid");
      setMapError("Mapbox token is missing. Please check your environment variables or set a fallback token.");
      return;
    }
    
    // Set the access token
    mapboxgl.accessToken = token;
    console.log("Mapbox token set successfully");
    
    try {
      // Create new map instance
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/${style}`,
        center: [lng, lat],
        zoom: zoom,
        interactive: true,
        attributionControl: true,
        preserveDrawingBuffer: true,
        antialias: true,
        failIfMajorPerformanceCaveat: false
      });
      
      // Set map reference
      map.current = newMap;
      
      // Add event listeners
      newMap.on('load', () => {
        console.log("Map loaded successfully");
        setMapReady(true);
        
        // Add marker
        try {
          new mapboxgl.Marker()
            .setLngLat([lng, lat])
            .addTo(newMap);
        } catch (err) {
          console.error("Error adding marker:", err);
        }
        
        // Add navigation controls
        try {
          newMap.addControl(new mapboxgl.NavigationControl());
        } catch (err) {
          console.error("Error adding navigation controls:", err);
        }
      });
      
      // Handle map errors
      newMap.on('error', (e) => {
        console.error("Mapbox error:", e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
      });
      
      // Update zoom state on zoom end
      newMap.on('zoomend', () => {
        if (map.current) {
          setZoom(map.current.getZoom());
        }
      });
      
    } catch (err) {
      console.error("Error initializing map:", err);
      setMapError(`Failed to initialize map: ${err.message}`);
    }
    
    // Cleanup on unmount
    return () => {
      if (map.current) {
        console.log("Cleaning up map");
        map.current.remove();
        map.current = null;
      }
    };
  }, [lat, lng]); // Only re-run if coordinates change
  
  // Handle style changes in a separate effect
  useEffect(() => {
    if (map.current && mapReady) {
      try {
        console.log("Changing map style to:", style);
        map.current.setStyle(`mapbox://styles/mapbox/${style}`);
      } catch (err) {
        console.error("Error changing map style:", err);
      }
    }
  }, [style, mapReady]);

  // Handle style change
  const handleStyleChange = (newStyle) => {
    console.log("Style change requested:", newStyle);
    setStyle(newStyle);
  };

  // Handle zoom change with better error handling
  const handleZoomChange = (direction) => {
    if (map.current && mapReady) {
      try {
        const currentZoom = map.current.getZoom();
        const newZoom = direction === 'in' 
          ? Math.min(currentZoom + 1, 20) 
          : Math.max(currentZoom - 1, 2);
        
        console.log("Zooming to:", newZoom);
        map.current.zoomTo(newZoom);
        setZoom(newZoom);
      } catch (err) {
        console.error("Error changing zoom:", err);
      }
    }
  };

  // Render error state with more helpful message
  if (mapError) {
    return (
      <div className="city-map-container">
        <div className="map-error">
          <h3>Map Loading Error</h3>
          <p>{mapError}</p>
          <p>To fix this issue:</p>
          <ol style={{ textAlign: 'left' }}>
            <li>Ensure you have a Mapbox access token in your .env file</li>
            <li>The variable should be named REACT_APP_MAPBOX_TOKEN</li>
            <li>Restart your development server after changes</li>
          </ol>
          <button onClick={() => window.location.reload()} className="retry-button">
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="city-map-container">
      <div 
        ref={mapContainer} 
        className="map-container" 
      />
      
      <div className="map-controls">
        <div className="map-style-selector">
          <label>Map Style:</label>
          <select 
            value={style} 
            onChange={(e) => handleStyleChange(e.target.value)}
            disabled={!mapReady}
          >
            {mapStyles.map((mapStyle) => (
              <option key={mapStyle.id} value={mapStyle.id}>
                {mapStyle.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="map-zoom-controls">
          <button 
            onClick={() => handleZoomChange('out')}
            disabled={!mapReady}
          >
            -
          </button>
          <span>Zoom: {zoom.toFixed(1)}</span>
          <button 
            onClick={() => handleZoomChange('in')}
            disabled={!mapReady}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default CityMapView;