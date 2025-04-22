// src/components/RadarMap.js
import React, { useState, useEffect, useRef } from 'react';
import './RadarMap.css';
import config from '../config'; // Import config

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
  const radarLayersRef = useRef({}); // Store all radar layers
  const debugMode = true; // Enable debug mode

  // Constants for tile configuration
  const TILE_SIZE = 256;
  const SMOOTH_DATA = 1; // 0 - not smooth, 1 - smooth
  const SNOW_COLORS = 1; // 0 - do not show snow colors, 1 - show snow colors
  const TILE_FORMAT = 'png'; // 'png' is more compatible than 'webp'
  
  // Debug logging function
  const debugLog = (...args) => {
    if (debugMode) {
      console.log('[RADAR DEBUG]', ...args);
    }
  };
  
  // Load radar data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        debugLog("Fetching radar data from backend API...");
        console.log(`API URL: ${config.API_URL}/api/radar/data`);
        
        // Use our backend API endpoint instead of calling RainViewer directly
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
        
        // Full dump of the data structure for debugging
        console.log("Full radar data structure:", JSON.stringify(data, null, 2));
        
        setRadarData(data.radar);
        
        // Validate the structure of the data
        debugLog("Validating radar data structure...");
        if (!data.radar.host) {
          console.warn("Missing host in radar data");
        }
        
        if (!data.radar.radar || !data.radar.radar.past) {
          console.warn("Missing radar.past in data structure");
        } else {
          debugLog(`Found ${data.radar.radar.past.length} past frames`);
        }
        
        if (!data.radar.radar || !data.radar.radar.nowcast) {
          console.warn("Missing radar.nowcast in data structure");
        } else {
          debugLog(`Found ${data.radar.radar.nowcast.length} forecast frames`);
        }
        
        // Start with the most recent past frame
        if (data.radar.radar && data.radar.radar.past && data.radar.radar.past.length > 0) {
          const lastPastFrameIndex = data.radar.radar.past.length - 1;
          debugLog(`Setting current frame to last past frame index: ${lastPastFrameIndex}`);
          setCurrentFrame(lastPastFrameIndex);
        }
      } catch (err) {
        console.error('Error loading radar data:', err);
        setError(`Failed to load radar data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Cleanup animation on unmount
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  // Initialize the map with Leaflet when component mounts
  useEffect(() => {
    if (!mapRef.current) {
      debugLog("Map reference not found, skipping initialization");
      return;
    }
    
    const initMap = () => {
      debugLog("Checking if Leaflet is available:", !!window.L);
      
      if (window.L) {
        debugLog("Initializing Leaflet map...");
        
        if (mapInstanceRef.current) {
          debugLog("Removing existing map instance");
          mapInstanceRef.current.remove();
        }
        
        // Use the provided coordinates or default to center of United States
        const initialLat = lat || 39.8283;
        const initialLng = lng || -98.5795;
        const initialZoom = 5;
        
        debugLog(`Map center: [${initialLat}, ${initialLng}], zoom: ${initialZoom}`);
        
        try {
          // Create map instance
          const map = window.L.map(mapRef.current, {
            center: [initialLat, initialLng],
            zoom: initialZoom,
            attributionControl: true
          });
          
          debugLog("Map instance created:", !!map);
          
          // Add OpenStreetMap tile layer
          const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Radar data &copy; <a href="https://rainviewer.com">RainViewer</a>',
            maxZoom: 19
          });
          
          tileLayer.on('loading', () => debugLog("Base map tiles loading started"));
          tileLayer.on('load', () => debugLog("Base map tiles loaded"));
          tileLayer.on('tileerror', (e) => console.error("Base map tile error:", e));
          
          tileLayer.addTo(map);
          
          debugLog("Base map tiles added");
          mapInstanceRef.current = map;
          
          // Add a marker to verify map is working
          const marker = window.L.marker([initialLat, initialLng]).addTo(map);
          marker.bindPopup("Map initialized!").openPopup();
          debugLog("Test marker added to map");
          
          // If radar data already loaded, update the radar layer
          if (radarData) {
            debugLog("Radar data already loaded, updating radar layer");
            updateRadarLayer();
          }
        } catch (e) {
          console.error("Error initializing map:", e);
        }
      } else {
        debugLog("Leaflet not found, loading library...");
        // Load Leaflet if not already loaded
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
        script.async = true;
        script.onload = () => {
          debugLog("Leaflet library loaded successfully");
          initMap();
        };
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
        
        document.head.appendChild(link);
        document.body.appendChild(script);
      }
    };
    
    // Initialize map
    initMap();
    
    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  // Update radar layer when current frame or radar data changes
  useEffect(() => {
    debugLog(`Frame or radar data changed, updating layer for frame ${currentFrame}`);
    debugLog("Radar data exists:", !!radarData);
    debugLog("Map exists:", !!mapInstanceRef.current);
    
    if (!radarData || !mapInstanceRef.current) return;
    
    updateRadarLayer();
  }, [currentFrame, colorScheme, radarData]);

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      debugLog("Starting animation playback");
      playAnimation();
    } else if (animationRef.current) {
      debugLog("Stopping animation playback");
      clearTimeout(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isPlaying, currentFrame]);

  // Update the radar layer with the current frame
  const updateRadarLayer = () => {
    if (!mapInstanceRef.current || !radarData || !radarData.radar) {
      debugLog("Cannot update radar layer: map or radar data not available", {
        mapExists: !!mapInstanceRef.current,
        radarDataExists: !!radarData,
        radarStructureExists: radarData && !!radarData.radar
      });
      return;
    }
    
    const map = mapInstanceRef.current;
    
    // Remove existing radar layer if it exists
    if (radarLayerRef.current) {
      debugLog("Removing existing radar layer");
      map.removeLayer(radarLayerRef.current);
    }
    
    // Get all frames (past and forecast)
    const allFrames = [...(radarData.radar.past || []), ...(radarData.radar.nowcast || [])];
    
    if (currentFrame >= allFrames.length || allFrames.length === 0) {
      console.error("Invalid current frame or no frames available", {
        currentFrame,
        framesLength: allFrames.length
      });
      return;
    }
    
    const frame = allFrames[currentFrame];
    const host = radarData.host;
    
    debugLog("Creating radar layer for frame:", frame);
    debugLog("Host:", host);
    debugLog("Path:", frame.path);
    
    try {
      // Create custom tile URL function that uses our backend API
      const tileUrl = (tilePoint) => {
        // Build tile URL through our backend proxy
        const url = `${config.API_URL}/api/radar/tile?` + 
               `host=${encodeURIComponent(host)}` +
               `&path=${encodeURIComponent(frame.path)}` +
               `&x=${tilePoint.x}` +
               `&y=${tilePoint.y}` +
               `&z=${tilePoint.z}` +
               `&color_scheme=${colorScheme}` +
               `&smooth=${SMOOTH_DATA}` +
               `&snow=${SNOW_COLORS}` +
               `&size=${TILE_SIZE}` +
               `&format=${TILE_FORMAT}`;
               
        // Log the first tile URL for debugging
        if (tilePoint.x === 0 && tilePoint.y === 0) {
          debugLog("Example tile URL:", url);
        }
        
        return url;
      };
      
      debugLog("Tile URL function created");
      
      // Create the tile layer with our custom URL function
      const tileLayer = window.L.tileLayer(tileUrl, {
        tileSize: TILE_SIZE,
        opacity: 0.9,
        zIndex: 100
      });
      
      // Cache the layer
      radarLayersRef.current[frame.path] = tileLayer;
      
      // Add event handlers for loading/loaded tiles
      let loadingTiles = 0;
      let loadedTiles = 0;
      
      tileLayer.on('loading', () => {
        loadingTiles++;
        debugLog(`Tile loading started. Total loading: ${loadingTiles}`);
      });
      
      tileLayer.on('load', () => {
        loadedTiles++;
        debugLog(`Tile loaded. Total loaded: ${loadedTiles} of ${loadingTiles}`);
      });
      
      tileLayer.on('tileerror', (error) => {
        console.error('Tile loading error:', error);
        // Attempt to load a sample tile directly to test
        const sampleTileUrl = `${config.API_URL}/api/radar/tile?` + 
                           `host=${encodeURIComponent(host)}` +
                           `&path=${encodeURIComponent(frame.path)}` +
                           `&x=0&y=0&z=0` +
                           `&color_scheme=${colorScheme}` +
                           `&smooth=${SMOOTH_DATA}` +
                           `&snow=${SNOW_COLORS}` +
                           `&size=${TILE_SIZE}` +
                           `&format=${TILE_FORMAT}`;
        
        debugLog("Testing direct tile fetch:", sampleTileUrl);
        
        // Try to fetch a test tile directly
        fetch(sampleTileUrl)
          .then(response => {
            debugLog("Test tile response:", response.status, response.statusText);
            return response.blob();
          })
          .then(blob => {
            debugLog("Test tile content type:", blob.type);
            debugLog("Test tile size:", blob.size);
          })
          .catch(error => {
            console.error("Test tile fetch error:", error);
          });
      });
      
      // Add the layer to the map
      tileLayer.addTo(map);
      debugLog("Radar layer added to map");
      radarLayerRef.current = tileLayer;
      
      // Show frame timestamp
      const frameTime = new Date(frame.time * 1000).toLocaleTimeString();
      debugLog(`Showing frame time: ${frameTime}`);
      
    } catch (err) {
      console.error("Error creating radar layer:", err);
    }
  };

  // Play radar animation
  const playAnimation = () => {
    if (!radarData || !radarData.radar) return;
    
    const allFrames = [...(radarData.radar.past || []), ...(radarData.radar.nowcast || [])];
    
    if (allFrames.length === 0) return;
    
    // Move to next frame
    const nextFrame = (currentFrame + 1) % allFrames.length;
    debugLog(`Animation advancing to frame ${nextFrame} of ${allFrames.length}`);
    setCurrentFrame(nextFrame);
    
    // Schedule the next frame update (500ms per frame)
    animationRef.current = setTimeout(playAnimation, 500);
  };

  // Toggle play/pause animation
  const togglePlay = () => {
    debugLog(`${isPlaying ? 'Pausing' : 'Playing'} animation`);
    setIsPlaying(!isPlaying);
  };

  // Handle color scheme change
  const handleColorSchemeChange = (e) => {
    const newScheme = parseInt(e.target.value, 10);
    debugLog(`Changing color scheme from ${colorScheme} to ${newScheme}`);
    setColorScheme(newScheme);
  };

  // Format timestamp for display
  const formatTimestamp = (unixTime) => {
    if (!unixTime) return '';
    const date = new Date(unixTime * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Check if a timestamp is in the past
  const isTimestampInPast = (unixTime) => {
    if (!unixTime) return true;
    return unixTime < Math.floor(Date.now() / 1000);
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
  
  if (!radarData || !radarData.radar) {
    return (
      <div className="radar-error">
        <div className="error-icon">⚠️</div>
        <p>No radar data available</p>
        <div className="error-details">
          Radar data structure is invalid or empty.
        </div>
      </div>
    );
  }

  // Combine past and forecast frames for display
  const allFrames = [...(radarData.radar.past || []), ...(radarData.radar.nowcast || [])];
  const currentFrameData = allFrames[currentFrame];
  
  // Get available color schemes
  const colorSchemes = radarData.options && radarData.options.color_schemes 
    ? radarData.options.color_schemes 
    : [
        { name: 'Original', value: 0 },
        { name: 'Universal Blue', value: 1 },
        { name: 'TITAN', value: 2 },
        { name: 'The Weather Channel', value: 3 },
        { name: 'Meteored', value: 4 },
        { name: 'NEXRAD Level-III', value: 5 },
        { name: 'Rainbow @ SELEX-SI', value: 6 },
        { name: 'Dark Sky', value: 7 },
        { name: 'Skyview', value: 8 }
      ];
  
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
            {colorSchemes.map((scheme) => (
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
        style={{ height: '400px', width: '100%', border: debugMode ? '1px solid red' : 'none' }}
      ></div>
      
      {debugMode && (
        <div className="radar-debug" style={{ marginTop: '10px', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Debug Information</h4>
          <p>Map initialized: {mapInstanceRef.current ? '✅' : '❌'}</p>
          <p>Radar data: {radarData ? '✅' : '❌'}</p>
          <p>Current frame: {currentFrame}</p>
          <p>Frames available: {allFrames.length}</p>
          <p>Color scheme: {colorScheme}</p>
          <button 
            onClick={() => console.log("Full radar data:", radarData)}
            style={{ marginRight: '10px', padding: '5px 10px' }}
          >
            Log Radar Data
          </button>
          <button 
            onClick={() => mapInstanceRef.current && mapInstanceRef.current.invalidateSize()}
            style={{ padding: '5px 10px' }}
          >
            Refresh Map
          </button>
        </div>
      )}
      
      <div className="radar-info">
        <p className="info-message">
          Radar shows precipitation when available. Areas without rain or snow will appear clear.
        </p>
      </div>
      
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