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
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [colorScheme, setColorScheme] = useState(2); // Default TITAN color scheme
  const [rateLimitMessage, setRateLimitMessage] = useState(null); // Moved up from below
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const radarLayerRef = useRef(null);
  const animationRef = useRef(null);
  const radarLayersRef = useRef({}); // Store all radar layers
  const debugMode = true; // Enable debug mode
  const mapInitializedRef = useRef(false); // Track if map has been initialized

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
        
        // After data is loaded, make sure map is initialized
        if (!mapInitializedRef.current) {
          initializeMap();
        }
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

  // Initialize map function (called immediately when component mounts)
  const initializeMap = () => {
    console.log("Initializing map...");
    
    // Add Leaflet CSS directly to head if not already added
    const linkExists = document.querySelector('link[href*="leaflet"]');
    if (!linkExists) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
      document.head.appendChild(link);
      console.log("Leaflet CSS added to head");
    }
    
    // Load Leaflet JS directly if not already loaded
    if (typeof window.L !== 'undefined') {
      console.log("Leaflet already loaded, creating map");
      createMap();
    } else {
      console.log("Leaflet not found, loading library...");
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
      script.onload = () => {
        console.log("Leaflet script loaded successfully");
        createMap();
      };
      script.onerror = (err) => {
        console.error("Error loading Leaflet:", err);
        setError("Failed to load map library. Please try again later.");
      };
      document.body.appendChild(script);
    }
  };
  
  // Create the actual map once Leaflet is available
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
    
    console.log("Creating map with container:", mapRef.current);
    console.log("Container dimensions:", {
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
        attribution: '&copy; OpenStreetMap contributors | Radar data &copy; <a href="https://rainviewer.com">RainViewer</a>',
        maxZoom: 19
      }).addTo(map);
      
      console.log("Base map created successfully");
      mapInstanceRef.current = map;
      mapInitializedRef.current = true;
      
      // Force a resize after a short delay
      setTimeout(() => {
        if (mapInstanceRef.current) {
          console.log("Forcing map resize");
          mapInstanceRef.current.invalidateSize(true);
          
          // After resize, update radar layer if data is available
          if (radarData) {
            updateRadarLayer();
          }
        }
      }, 500);
      
      // Add a marker to confirm map is working
      window.L.marker([lat || 39.8283, lng || -98.5795])
        .addTo(map)
        .bindPopup('Map initialized!')
        .openPopup();
        
    } catch (error) {
      console.error("Error creating map:", error);
      setError(`Failed to initialize map: ${error.message}`);
    }
  };

  // Initialize the map component immediately when it mounts
  useEffect(() => {
    console.log("RadarMap component mounted");
    
    // Initialize the map immediately
    if (!mapInitializedRef.current) {
      initializeMap();
    }
    
    // Clean up on unmount
    return () => {
      if (mapInstanceRef.current) {
        console.log("Cleaning up map on unmount");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitializedRef.current = false;
      }
    };
  }, []);

  // Update when lat/lng props change
  useEffect(() => {
    if (mapInstanceRef.current && mapInitializedRef.current) {
      console.log("Coordinates changed, updating map center");
      mapInstanceRef.current.setView([lat || 39.8283, lng || -98.5795], 5);
    }
  }, [lat, lng]);

  // Update radar layer when current frame or radar data changes
  useEffect(() => {
    if (!radarData || !mapInstanceRef.current || !mapInitializedRef.current) {
      debugLog("Skipping radar update - map or data not ready");
      return;
    }
    
    debugLog(`Frame or radar data changed, updating layer for frame ${currentFrame}`);
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
    console.log("updateRadarLayer called");
    
    // Check if we have the map and data
    if (!mapInstanceRef.current || !mapInitializedRef.current) {
      console.error("Cannot update radar layer: Map is not initialized");
      return;
    }
    
    if (!radarData) {
      console.error("Cannot update radar layer: No radar data available");
      return;
    }
    
    // Check the structure of radarData
    console.log("Radar data structure:", Object.keys(radarData));
    
    // Verify we have radar.past or radar.radar.past
    let pastFrames = [];
    let forecastFrames = [];
    
    // Handle both possible data structures (data.radar.past or data.radar.radar.past)
    if (radarData.radar && Array.isArray(radarData.radar.past)) {
      console.log("Found frames in radarData.radar.past");
      pastFrames = radarData.radar.past;
    } else if (radarData.radar && radarData.radar.radar && Array.isArray(radarData.radar.radar.past)) {
      console.log("Found frames in radarData.radar.radar.past");
      pastFrames = radarData.radar.radar.past;
    } else {
      console.error("No past frames found in radar data");
      console.log("Radar data structure:", JSON.stringify(radarData));
      return;
    }
    
    // Get forecast frames
    if (radarData.radar && Array.isArray(radarData.radar.nowcast)) {
      forecastFrames = radarData.radar.nowcast;
    } else if (radarData.radar && radarData.radar.radar && Array.isArray(radarData.radar.radar.nowcast)) {
      forecastFrames = radarData.radar.radar.nowcast;
    }
    
    const allFrames = [...pastFrames, ...forecastFrames];
    console.log(`Total frames available: ${allFrames.length} (${pastFrames.length} past, ${forecastFrames.length} forecast)`);
    
    if (allFrames.length === 0) {
      console.error("No frames available in radar data");
      return;
    }
    
    if (currentFrame >= allFrames.length) {
      console.error(`Invalid current frame: ${currentFrame} (max: ${allFrames.length - 1})`);
      return;
    }
    
    const map = mapInstanceRef.current;
    
    // Remove existing radar layer if it exists
    if (radarLayerRef.current) {
      console.log("Removing existing radar layer");
      map.removeLayer(radarLayerRef.current);
    }
    
    // Get the frame data
    const frame = allFrames[currentFrame];
    console.log("Using frame:", frame);
    
    // Get the host
    const host = radarData.host || "https://tilecache.rainviewer.com";
    console.log("Using host:", host);
    
    try {
      // Custom getTileUrl function with caching to reduce API calls
      const getTileUrl = (coords) => {
        const x = coords.x;
        const y = coords.y;
        const z = coords.z;
        
        // Create a cache key based on all parameters
        const cacheKey = `${host}_${frame.path}_${x}_${y}_${z}_${colorScheme}_${SMOOTH_DATA}_${SNOW_COLORS}_${TILE_SIZE}_${TILE_FORMAT}`;
        
        // Generate the actual URL
        const url = `${config.API_URL}/api/radar/tile?` + 
              `host=${encodeURIComponent(host)}` +
              `&path=${encodeURIComponent(frame.path)}` +
              `&x=${x}` +
              `&y=${y}` +
              `&z=${z}` +
              `&color_scheme=${colorScheme}` +
              `&smooth=${SMOOTH_DATA}` +
              `&snow=${SNOW_COLORS}` +
              `&size=${TILE_SIZE}` +
              `&format=${TILE_FORMAT}`;
        
        return url;
      };
      
      // Create a template string version for Leaflet
      const tileUrlTemplate = `${config.API_URL}/api/radar/tile?` + 
                `host=${encodeURIComponent(host)}` +
                `&path=${encodeURIComponent(frame.path)}` +
                `&x={x}` +
                `&y={y}` +
                `&z={z}` +
                `&color_scheme=${colorScheme}` +
                `&smooth=${SMOOTH_DATA}` +
                `&snow=${SNOW_COLORS}` +
                `&size=${TILE_SIZE}` +
                `&format=${TILE_FORMAT}`;
      
      console.log("Tile URL template:", tileUrlTemplate);
      
      // Create the tile layer with rate limiting protection
      const tileLayer = window.L.tileLayer(tileUrlTemplate, {
        tileSize: TILE_SIZE,
        opacity: 0.9,
        zIndex: 100,
        // Add caching mechanism 
        maxZoom: 19,
        // Add bounds to limit tile fetching
        bounds: mapInstanceRef.current.getBounds().pad(0.5), // Only fetch tiles in current view + 50% padding
        // Add error tile URL to show when tiles fail to load
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' // Transparent 1x1 pixel
      });
      
      // Add event handlers for loading/loaded tiles
      tileLayer.on('loading', () => console.log("Radar tiles loading started"));
      tileLayer.on('load', () => console.log("Radar tiles loaded"));
      
      tileLayer.on('tileerror', (error) => {
        console.error("Radar tile error:", error);
        
        // Don't test with additional API calls if we're already rate limited
        if (error && error.target && error.target._url && error.target._url.includes("429")) {
          console.warn("Rate limiting detected, pausing animation to prevent further errors");
          if (isPlaying) {
            setIsPlaying(false); // Auto-pause if we hit rate limits
          }
          return; // Don't make another request that will also get rate limited
        }
        
        // Test a direct tile fetch only if not rate limited
        const testUrl = `${config.API_URL}/api/radar/tile?` + 
                     `host=${encodeURIComponent(host)}` +
                     `&path=${encodeURIComponent(frame.path)}` +
                     `&x=0&y=0&z=0` +
                     `&color_scheme=${colorScheme}` +
                     `&smooth=${SMOOTH_DATA}` +
                     `&snow=${SNOW_COLORS}` +
                     `&size=${TILE_SIZE}` +
                     `&format=${TILE_FORMAT}`;
        
        console.log("Testing tile URL directly:", testUrl);
        
        fetch(testUrl)
          .then(response => {
            console.log("Direct tile fetch response:", response.status);
            
            // Check for rate limiting
            if (response.status === 429) {
              console.warn("Rate limit confirmed by direct fetch, pausing animation");
              if (isPlaying) {
                setIsPlaying(false); // Auto-pause on rate limit
              }
              // Show a brief alert to the user
              alert("Radar data is temporarily unavailable due to rate limiting. Please wait a moment and try again.");
              return null; // Don't try to process the blob
            }
            
            return response.blob();
          })
          .then(blob => {
            if (blob) {
              console.log("Direct tile content:", blob.type, blob.size);
            }
          })
          .catch(err => {
            console.error("Direct tile fetch error:", err);
          });
      });
      
      // Add layer to map
      console.log("Adding radar layer to map");
      tileLayer.addTo(map);
      radarLayerRef.current = tileLayer;
      
      // Show frame timestamp
      const frameTime = new Date(frame.time * 1000).toLocaleTimeString();
      console.log(`Frame time: ${frameTime}`);
      
    } catch (err) {
      console.error("Error creating radar layer:", err);
    }
  };

  // Play radar animation with rate limiting protection
  const playAnimation = () => {
    if (!radarData) return;
    
    // Get frames based on data structure
    let allFrames = [];
    
    if (radarData.radar && Array.isArray(radarData.radar.past)) {
      allFrames = [...radarData.radar.past, ...(radarData.radar.nowcast || [])];
    } else if (radarData.radar && radarData.radar.radar && Array.isArray(radarData.radar.radar.past)) {
      allFrames = [...radarData.radar.radar.past, ...(radarData.radar.radar.nowcast || [])];
    }
    
    if (allFrames.length === 0) return;
    
    // Move to next frame
    const nextFrame = (currentFrame + 1) % allFrames.length;
    debugLog(`Animation advancing to frame ${nextFrame} of ${allFrames.length}`);
    setCurrentFrame(nextFrame);
    
    // IMPROVED: Much longer delay (2 seconds) to prevent rate limiting
    animationRef.current = setTimeout(playAnimation, 2000); // Significantly increased from 750ms
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

  // Determine frames based on data structure
  let allFrames = [];
  if (radarData.radar && Array.isArray(radarData.radar.past)) {
    allFrames = [...radarData.radar.past, ...(radarData.radar.nowcast || [])];
  } else if (radarData.radar && radarData.radar.radar && Array.isArray(radarData.radar.radar.past)) {
    allFrames = [...radarData.radar.radar.past, ...(radarData.radar.radar.nowcast || [])];
  }
  
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
  
  // Function to clear the rate limit message after a delay
  const clearRateLimitMessage = () => {
    setTimeout(() => {
      setRateLimitMessage(null);
    }, 5000); // Clear after 5 seconds
  };
  
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
            onClick={() => {
              // Check if we should show a rate limit warning for animation
              if (!isPlaying && allFrames.length > 5) {
                setRateLimitMessage("Playing at a slower speed to avoid rate limiting");
                clearRateLimitMessage();
              }
              togglePlay();
            }}
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
          <p>Map initialized: {mapInitializedRef.current ? '✅' : '❌'}</p>
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
                initializeMap();
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