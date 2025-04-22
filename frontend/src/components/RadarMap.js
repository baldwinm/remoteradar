// src/components/RadarMap.js
import React, { useState, useEffect, useRef } from 'react';
import './RadarMap.css';

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

  // Constants for tile configuration
  const TILE_SIZE = 256;
  const SMOOTH_DATA = 1; // 0 - not smooth, 1 - smooth
  const SNOW_COLORS = 1; // 0 - do not show snow colors, 1 - show snow colors
  const TILE_FORMAT = 'png'; // 'png' is more compatible than 'webp'
  
  // Load radar data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Use the public RainViewer API endpoint
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("RainViewer API data:", data);
        
        setRadarData(data);
        
        // Start with the most recent past frame
        if (data.radar && data.radar.past && data.radar.past.length > 0) {
          setCurrentFrame(data.radar.past.length - 1);
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

  // Function to find active precipitation areas
  const findActivePrecipitationAreas = () => {
    // These are known regions that typically have precipitation
    // You can expand this list for better coverage
    return [
      { name: "US East Coast", lat: 40.7128, lng: -74.0060, zoom: 5 },
      { name: "US West Coast", lat: 37.7749, lng: -122.4194, zoom: 5 },
      { name: "US Gulf Coast", lat: 29.7604, lng: -95.3698, zoom: 5 },
      { name: "US Midwest", lat: 41.8781, lng: -87.6298, zoom: 5 },
      { name: "Europe", lat: 51.5074, lng: -0.1278, zoom: 4 },
      { name: "East Asia", lat: 35.6762, lng: 139.6503, zoom: 4 },
    ];
  };

  // Initialize the map with Leaflet when component mounts
  useEffect(() => {
    if (!mapRef.current) return;
    
    const initMap = () => {
      if (window.L) {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }
        
        // Determine the initial center
        let initialCenter = [lat || 39.8283, lng || -98.5795];
        let initialZoom = 5;
        
        // If no specific coordinates are provided, use the first active precipitation area
        if (!lat || !lng) {
          const activeAreas = findActivePrecipitationAreas();
          if (activeAreas.length > 0) {
            const firstArea = activeAreas[0];
            initialCenter = [firstArea.lat, firstArea.lng];
            initialZoom = firstArea.zoom;
            console.log(`No specific coordinates provided. Using ${firstArea.name} as default.`);
          }
        }
        
        // Create map instance
        const map = window.L.map(mapRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          attributionControl: true
        });
        
        console.log(`Map initialized with center: [${initialCenter[0]}, ${initialCenter[1]}], zoom: ${initialZoom}`);
        
        // Add OpenStreetMap tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Radar data &copy; <a href="https://rainviewer.com">RainViewer</a>',
          maxZoom: 19
        }).addTo(map);
        
        mapInstanceRef.current = map;
        
        // If radar data already loaded, update the radar layer
        if (radarData) {
          updateRadarLayer();
        }
      } else {
        // Load Leaflet if not already loaded
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
        script.async = true;
        script.onload = initMap;
        
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
    if (!radarData || !mapInstanceRef.current) return;
    
    updateRadarLayer();
  }, [currentFrame, radarData, colorScheme]);

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      playAnimation();
    } else if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isPlaying, currentFrame, radarData]);

  // Update the radar layer with the current frame
  const updateRadarLayer = () => {
    if (!mapInstanceRef.current || !radarData) return;
    
    const map = mapInstanceRef.current;
    
    // Remove existing radar layer if it exists
    if (radarLayerRef.current) {
      map.removeLayer(radarLayerRef.current);
    }
    
    // Get all frames (past and forecast)
    const allFrames = [...(radarData.radar.past || []), ...(radarData.radar.nowcast || [])];
    
    if (currentFrame >= allFrames.length || allFrames.length === 0) {
      console.error("Invalid current frame or no frames available");
      return;
    }
    
    const frame = allFrames[currentFrame];
    const host = radarData.host;
    
    console.log("Creating radar layer for frame:", frame);
    console.log("Host:", host);
    console.log("Path:", frame.path);
    
    // Construct the correct URL format based on the RainViewer API documentation
    // Format should be: host + path + '/256/{z}/{x}/{y}/colorScheme/smooth_snow.png'
    try {
      // Create the tile layer with the correct URL format
      const tileLayer = window.L.tileLayer(`${host}${frame.path}/${TILE_SIZE}/{z}/{x}/{y}/${colorScheme}/${SMOOTH_DATA}_${SNOW_COLORS}.${TILE_FORMAT}`, {
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
        console.log(`Tile loading started. Total loading: ${loadingTiles}`);
      });
      
      tileLayer.on('load', () => {
        loadedTiles++;
        console.log(`Tile loaded. Total loaded: ${loadedTiles} of ${loadingTiles}`);
        
        // Add a custom overlay if no precipitation is visible
        if (loadedTiles === loadingTiles && loadedTiles > 0) {
          // Wait a bit to ensure all tiles are fully loaded
          setTimeout(() => {
            // Check if any precipitation is visible (simple heuristic)
            // We'll add a message to notify users they can pan/zoom to find precipitation
            if (!document.querySelector('.no-precipitation-message')) {
              const container = document.createElement('div');
              container.className = 'no-precipitation-message';
              container.innerHTML = 'No precipitation is currently visible in this area. Try zooming out or panning to other regions.';
              container.style.position = 'absolute';
              container.style.top = '50%';
              container.style.left = '50%';
              container.style.transform = 'translate(-50%, -50%)';
              container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              container.style.padding = '10px';
              container.style.borderRadius = '5px';
              container.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
              container.style.zIndex = '1000';
              container.style.pointerEvents = 'none'; // Allow clicking through
              container.style.display = 'none'; // Hide initially
              
              // Add to the map container and show after a delay
              mapRef.current.appendChild(container);
              setTimeout(() => {
                container.style.display = 'block';
              }, 3000); // Show after 3 seconds if no precipitation data becomes visible
            }
          }, 1000);
        }
      });
      
      tileLayer.on('tileerror', (error) => {
        console.error('Tile loading error:', error);
      });
      
      // Add the layer to the map
      tileLayer.addTo(map);
      radarLayerRef.current = tileLayer;
      
      // Show frame timestamp
      console.log(`Showing frame time: ${new Date(frame.time * 1000).toLocaleTimeString()}`);
      
    } catch (err) {
      console.error("Error creating radar layer:", err);
    }
  };

  // Play radar animation
  const playAnimation = () => {
    if (!radarData) return;
    
    const allFrames = [...(radarData.radar.past || []), ...(radarData.radar.nowcast || [])];
    
    if (allFrames.length === 0) return;
    
    // Move to next frame
    const nextFrame = (currentFrame + 1) % allFrames.length;
    setCurrentFrame(nextFrame);
    
    // Schedule the next frame update (500ms per frame)
    animationRef.current = setTimeout(playAnimation, 500);
  };

  // Toggle play/pause animation
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Handle color scheme change
  const handleColorSchemeChange = (e) => {
    setColorScheme(parseInt(e.target.value, 10));
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
      </div>
    );
  }
  
  if (!radarData || !radarData.radar) {
    return (
      <div className="radar-error">
        <div className="error-icon">⚠️</div>
        <p>No radar data available</p>
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