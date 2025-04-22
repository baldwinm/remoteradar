// src/components/RadarMap.js
import React, { useState, useEffect, useRef } from 'react';
import { fetchRadarData, generateTileUrl, formatTimestamp, isTimestampInPast } from '../services/radar';
import './RadarMap.css'; // We'll create this next

const RadarMap = ({ lat, lng }) => {
  const [radarData, setRadarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [colorScheme, setColorScheme] = useState(2); // Default TITAN color scheme
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const radarLayerRef = useRef(null);
  const animationRef = useRef(null);

  // Load radar data
  useEffect(() => {
    const loadRadarData = async () => {
      try {
        setLoading(true);
        const data = await fetchRadarData();
        setRadarData(data);
        
        // Start with the most recent past frame
        if (data.radar && data.radar.past && data.radar.past.length > 0) {
          setCurrentFrame(data.radar.past.length - 1);
        }
      } catch (err) {
        console.error('Error loading radar data:', err);
        setError('Failed to load radar data');
      } finally {
        setLoading(false);
      }
    };

    loadRadarData();
    
    // Cleanup animation on unmount
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  // Initialize the map
  useEffect(() => {
    if (!window.L) {
      // If Leaflet is not loaded, add it to the document
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
      script.async = true;
      script.onload = initializeMap;
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
      
      document.head.appendChild(link);
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
        document.head.removeChild(link);
      };
    } else {
      // If Leaflet is already loaded, initialize the map directly
      initializeMap();
    }
    
    // Cleanup function to destroy the map when component unmounts
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  // Update radar layer when current frame changes
  useEffect(() => {
    if (!radarData || !mapInstanceRef.current) return;
    
    updateRadarLayer();
  }, [currentFrame, radarData, colorScheme]);

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      playAnimation();
    } else {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isPlaying, currentFrame, radarData]);

  // Initialize the map with Leaflet
  const initializeMap = () => {
    if (!mapRef.current || !window.L) return;
    
    // If a map already exists, destroy it first
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }
    
    // Create the map instance
    const map = window.L.map(mapRef.current, {
      center: [lat || 40.7128, lng || -74.0060], // Default to NYC if no coords
      zoom: 8,
      attributionControl: true,
    });
    
    // Add attribution
    map.attributionControl.addAttribution('Radar data © <a href="https://rainviewer.com">RainViewer</a>');
    
    // Add OpenStreetMap tile layer
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Save the map instance to ref
    mapInstanceRef.current = map;
    
    // If radar data is already loaded, add the radar layer
    if (radarData) {
      updateRadarLayer();
    }
  };

  // Update the radar layer with the current frame
  const updateRadarLayer = async () => {
    if (!mapInstanceRef.current || !radarData) return;
    
    // Remove existing radar layer if it exists
    if (radarLayerRef.current) {
      mapInstanceRef.current.removeLayer(radarLayerRef.current);
      radarLayerRef.current = null;
    }
    
    // Determine which collection (past or forecast) to use
    const allFrames = [...radarData.radar.past, ...radarData.radar.forecast];
    if (currentFrame >= allFrames.length) return;
    
    const frame = allFrames[currentFrame];
    const host = radarData.host;
    
    // Create a new TileLayer for the radar
    const tileLayer = window.L.tileLayer(`${host}${frame.path}/{z}/{x}/{y}/${colorScheme}/1_1.png`, {
      tileSize: 256,
      opacity: 0.9,
      zIndex: 100
    });
    
    // Add the layer to the map
    tileLayer.addTo(mapInstanceRef.current);
    radarLayerRef.current = tileLayer;
  };

  // Play radar animation
  const playAnimation = () => {
    if (!radarData) return;
    
    const allFrames = [...radarData.radar.past, ...radarData.radar.forecast];
    
    // Move to next frame
    const nextFrame = (currentFrame + 1) % allFrames.length;
    setCurrentFrame(nextFrame);
    
    // Schedule the next frame update
    animationRef.current = setTimeout(playAnimation, 500); // 500ms per frame
  };

  // Toggle play/pause animation
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Handle color scheme change
  const handleColorSchemeChange = (e) => {
    setColorScheme(parseInt(e.target.value, 10));
  };

  if (loading) {
    return (
      <div className="radar-loading">
        <div className="loading-spinner"></div>
        <p>Loading radar data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="radar-error">
        <div className="error-icon">⚠️</div>
        <p>Error loading radar data: {error}</p>
      </div>
    );
  }
  
  if (!radarData) {
    return (
      <div className="radar-error">
        <div className="error-icon">⚠️</div>
        <p>No radar data available</p>
      </div>
    );
  }

  // Combine past and forecast frames for display
  const allFrames = [...radarData.radar.past, ...radarData.radar.forecast];
  const currentFrameData = allFrames[currentFrame];
  
  return (
    <div className="radar-component">
      <div className="radar-controls">
        <div className="radar-timestamp">
          {currentFrameData && (
            <span className={isTimestampInPast(currentFrameData.time) ? 'timestamp-past' : 'timestamp-forecast'}>
              {isTimestampInPast(currentFrameData.time) ? 'Past: ' : 'Forecast: '}
              {formatTimestamp(currentFrameData.time)}
            </span>
          )}
        </div>
        
        <div className="radar-buttons">
          <button 
            className="radar-button" 
            onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
            disabled={currentFrame === 0}
          >
            ⏮
          </button>
          
          <button 
            className="radar-button play-pause" 
            onClick={togglePlay}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
          
          <button 
            className="radar-button" 
            onClick={() => setCurrentFrame(Math.min(allFrames.length - 1, currentFrame + 1))}
            disabled={currentFrame === allFrames.length - 1}
          >
            ⏭
          </button>
        </div>
        
        <div className="radar-options">
          <label htmlFor="colorScheme">Color Scheme: </label>
          <select 
            id="colorScheme" 
            value={colorScheme} 
            onChange={handleColorSchemeChange}
          >
            {radarData.options.color_schemes.map((scheme) => (
              <option key={scheme.value} value={scheme.value}>
                {scheme.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="radar-timeline">
        {allFrames.map((frame, index) => (
          <div 
            key={index}
            className={`timeline-marker ${index === currentFrame ? 'active' : ''} ${isTimestampInPast(frame.time) ? 'past' : 'forecast'}`}
            onClick={() => setCurrentFrame(index)}
            title={formatTimestamp(frame.time)}
          />
        ))}
        
        <div className="timeline-labels">
          <span className="timeline-label past">Past</span>
          <span className="timeline-label forecast">Forecast</span>
        </div>
      </div>
      
      <div 
        ref={mapRef} 
        className="radar-map"
        style={{ height: '400px', width: '100%' }}
      ></div>
      
      <div className="radar-legend">
        <p className="legend-title">Precipitation Intensity</p>
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