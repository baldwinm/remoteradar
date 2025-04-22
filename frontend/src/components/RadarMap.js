// src/components/RadarMap.js
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import radarService from '../services/radar';

// Import custom styles
import './RadarMap.css';

const RadarMap = ({ lat, lng, zoom = 8 }) => {
  const [apiData, setApiData] = useState(null);
  const [mapFrames, setMapFrames] = useState([]);
  const [animationPosition, setAnimationPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [radarLayers, setRadarLayers] = useState([]);
  const [currentLayerIndex, setCurrentLayerIndex] = useState(-1);
  const [mapType, setMapType] = useState('past'); // 'past' or 'forecast'
  const [loadingStatus, setLoadingStatus] = useState('loading');
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const animationTimerRef = useRef(null);
  
  // Options for radar display
  const options = {
    colorScheme: 2,
    smoothData: 1,
    snowColors: 1,
    tileSize: 256,
    format: 'webp'
  };
  
  // Initialize the map on component mount
  useEffect(() => {
    // Create map instance if it doesn't exist
    if (!mapInstanceRef.current && mapRef.current) {
      // Set default coordinates if not provided
      const defaultLat = lat || 39.8283;
      const defaultLng = lng || -98.5795;
      
      // Initialize the map
      mapInstanceRef.current = L.map(mapRef.current).setView([defaultLat, defaultLng], zoom);
      
      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }
    
    // Fetch radar data
    fetchRadarData();
    
    // Clean up map instance on component unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      
      // Clear animation timer
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [lat, lng, zoom]);
  
  // Update animation when frames change or animation position changes
  useEffect(() => {
    if (mapFrames.length > 0 && mapInstanceRef.current) {
      showFrame(animationPosition);
    }
  }, [mapFrames, animationPosition]);
  
  // Handle animation when playing status changes
  useEffect(() => {
    if (isPlaying) {
      moveNext();
    } else if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [isPlaying, animationPosition, mapFrames.length]);
  
  // Fetch radar data from the backend
  const fetchRadarData = async () => {
    try {
      setLoadingStatus('loading');
      
      // Fetch data from our backend API
      const data = await radarService.fetchRadarData();
      setApiData(data);
      
      // Initialize with past frames by default
      initializeRadar(data, 'past');
      
      setLoadingStatus('loaded');
    } catch (error) {
      console.error('Failed to fetch radar data:', error);
      setLoadingStatus('error');
    }
  };
  
  // Initialize radar with the specified type (past or forecast)
  const initializeRadar = (data, type) => {
    if (!data || !data.radar) return;
    
    // Clear previous layers
    clearLayers();
    
    // Set the map type
    setMapType(type);
    
    // Get frames based on type
    const frames = type === 'past' ? data.radar.past : data.radar.forecast;
    
    // Set frames for animation
    setMapFrames(frames);
    
    // Reset animation position
    setAnimationPosition(0);
    
    // Create new radar layers
    createRadarLayers(data.host, frames);
  };
  
  // Clear all radar layers from the map
  const clearLayers = () => {
    radarLayers.forEach(layer => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    
    setRadarLayers([]);
    setCurrentLayerIndex(-1);
  };
  
  // Create radar layers for each frame
  const createRadarLayers = (host, frames) => {
    if (!mapInstanceRef.current) return;
    
    const createLayer = async (frame, index) => {
      try {
        // Generate tile URL template
        const tileUrl = await radarService.generateTileUrl(
          host, 
          frame.path, 
          '{x}', 
          '{y}', 
          '{z}', 
          options
        );
        
        // Create a tile layer for the frame
        return L.tileLayer(tileUrl, {
          tileSize: options.tileSize,
          opacity: 0,
          zIndex: 1
        });
      } catch (error) {
        console.error(`Error creating layer for frame ${index}:`, error);
        return null;
      }
    };
    
    // Create all layers
    Promise.all(frames.map(createLayer))
      .then(layers => {
        // Filter out null layers
        const validLayers = layers.filter(layer => layer !== null);
        setRadarLayers(validLayers);
      })
      .catch(error => {
        console.error('Error creating radar layers:', error);
      });
  };
  
  // Show the frame at the specified position
  const showFrame = (position) => {
    if (position >= mapFrames.length) {
      position = 0;
    }
    if (position < 0) {
      position = mapFrames.length - 1;
    }
    
    setAnimationPosition(position);
    
    // Hide all layers
    radarLayers.forEach((layer, index) => {
      if (index === position) {
        // Show the current layer if it's not already on the map
        if (!mapInstanceRef.current.hasLayer(layer)) {
          layer.addTo(mapInstanceRef.current);
        }
        layer.setOpacity(0.7); // Set opacity to show the layer
        setCurrentLayerIndex(index);
      } else {
        // Hide other layers
        layer.setOpacity(0);
        // Optionally remove layers not in view to save resources
        if (mapInstanceRef.current.hasLayer(layer)) {
          mapInstanceRef.current.removeLayer(layer);
        }
      }
    });
  };
  
  // Move to the next frame
  const moveNext = () => {
    // Calculate next position
    const nextPosition = (animationPosition + 1) % mapFrames.length;
    
    // Show next frame
    showFrame(nextPosition);
    
    // Schedule next frame change if playing
    if (isPlaying) {
      animationTimerRef.current = setTimeout(() => {
        moveNext();
      }, 500); // Animation speed: 500ms between frames
    }
  };
  
  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };
  
  // Move to previous frame
  const movePrevious = () => {
    const prevPosition = animationPosition - 1;
    showFrame(prevPosition < 0 ? mapFrames.length - 1 : prevPosition);
  };
  
  // Move to next frame
  const moveForward = () => {
    const nextPosition = animationPosition + 1;
    showFrame(nextPosition >= mapFrames.length ? 0 : nextPosition);
  };
  
  // Toggle between past and forecast radar
  const toggleRadarType = () => {
    const newType = mapType === 'past' ? 'forecast' : 'past';
    initializeRadar(apiData, newType);
  };
  
  // Format current frame time
  const formatCurrentFrameTime = () => {
    if (!mapFrames.length || animationPosition >= mapFrames.length) {
      return 'No data';
    }
    
    const frame = mapFrames[animationPosition];
    return frame.timestamp || radarService.formatTimestamp(frame.time);
  };
  
  return (
    <div className="radar-container">
      <div className="radar-controls">
        <div className="radar-type-toggle">
          <button
            className={mapType === 'past' ? 'active' : ''}
            onClick={() => initializeRadar(apiData, 'past')}
          >
            Past
          </button>
          <button
            className={mapType === 'forecast' ? 'active' : ''}
            onClick={() => initializeRadar(apiData, 'forecast')}
            disabled={!apiData?.radar?.forecast?.length}
          >
            Forecast
          </button>
        </div>
        
        <div className="radar-animation-controls">
          <button onClick={movePrevious} title="Previous Frame">
            &lt;
          </button>
          <button onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={moveForward} title="Next Frame">
            &gt;
          </button>
        </div>
        
        <div className="radar-time">
          {formatCurrentFrameTime()}
        </div>
      </div>
      
      {loadingStatus === 'loading' && (
        <div className="radar-loading">
          <div className="radar-loading-spinner"></div>
          <p>Loading radar data...</p>
        </div>
      )}
      
      {loadingStatus === 'error' && (
        <div className="radar-error">
          <p>Failed to load radar data. Please try again later.</p>
          <button onClick={fetchRadarData}>Retry</button>
        </div>
      )}
      
      <div 
        ref={mapRef} 
        className="radar-map" 
        style={{ 
          display: loadingStatus === 'loaded' ? 'block' : 'none',
          height: '400px',
          width: '100%'
        }}
      ></div>
      
      {loadingStatus === 'loaded' && mapFrames.length > 0 && (
        <div className="radar-timeline">
          {mapFrames.map((frame, index) => (
            <div
              key={frame.time}
              className={`radar-timeline-item ${index === animationPosition ? 'active' : ''}`}
              onClick={() => showFrame(index)}
              title={frame.timestamp || radarService.formatTimestamp(frame.time)}
            >
              <div className="radar-timeline-marker"></div>
            </div>
          ))}
        </div>
      )}
      
      <div className="radar-attribution">
        Weather radar data provided by <a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">RainViewer</a>
      </div>
    </div>
  );
};

export default RadarMap;
