import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './CityMapView.css';

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
    console.log("Environment variables available:", !!process.env.REACT_APP_MAPBOX_TOKEN);
    
    // Set Mapbox access token
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (!token) {
      console.error("Mapbox token is missing");
      setMapError("Mapbox token is missing. Please check your environment variables.");
      return;
    }
    
    mapboxgl.accessToken = token;
    
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

  // Render error state
  if (mapError) {
    return (
      <div className="city-map-container">
        <div className="map-error">
          <p>{mapError}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
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