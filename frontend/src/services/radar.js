// src/services/radar.js
/**
 * Service for handling RainViewer radar data via our backend API
 */
import config from '../config';

// API base URLs
const RADAR_API_URL = `${config.API_URL}/api/radar`;
const RADAR_TILE_API_URL = `${config.API_URL}/api/radar/tile`;

/**
 * Fetch radar data from the backend
 * @returns {Promise<Object>} Radar data including frames
 */
export const fetchRadarData = async () => {
  try {
    const response = await fetch(RADAR_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      mode: 'cors',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch radar data: ${response.status}, ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.radar) {
      throw new Error('Invalid radar data format');
    }
    
    return data.radar;
  } catch (error) {
    console.error('Error fetching radar data:', error);
    throw error;
  }
};

/**
 * Generate radar tile URL via the backend
 * @param {String} host - The host from API data
 * @param {String} path - The path for the specific frame
 * @param {Number} x - Tile X coordinate
 * @param {Number} y - Tile Y coordinate
 * @param {Number} z - Zoom level
 * @param {Object} options - Additional options
 * @returns {String} URL for the radar tile
 */
export const generateTileUrl = async (host, path, x, y, z, options = {}) => {
  const {
    colorScheme = 2, // Default color scheme (2 is a good general-purpose scheme)
    smoothData = 1,  // Smooth the data (0 - not smooth, 1 - smooth)
    snowColors = 1,  // Show snow colors (0 - don't show, 1 - show)
    tileSize = 256,  // Tile size (256 or 512)
    format = 'webp'  // Image format (webp or png)
  } = options;
  
  try {
    // For increased performance, we'll generate the tile URL directly on the frontend
    // This avoids an extra API call for each tile
    return `${host}${path}/${tileSize}/${z}/${x}/${y}/${colorScheme}/${smoothData}_${snowColors}.${format}`;
    
    // Note: The backend endpoint is available if needed for more complex scenarios:
    /*
    const params = new URLSearchParams({
      host,
      path,
      x,
      y,
      z,
      color_scheme: colorScheme,
      smooth: smoothData,
      snow: snowColors,
      size: tileSize,
      format
    });
    
    const response = await fetch(`${RADAR_TILE_API_URL}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      mode: 'cors',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate tile URL: ${response.status}, ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.url) {
      throw new Error('Invalid tile URL response');
    }
    
    return data.url;
    */
  } catch (error) {
    console.error('Error generating tile URL:', error);
    // Return a fallback URL in case of error
    return `${host}${path}/${tileSize}/${z}/${x}/${y}/${colorScheme}/${smoothData}_${snowColors}.${format}`;
  }
};

/**
 * Format timestamp into human-readable format
 * @param {Number} timestamp - Unix timestamp
 * @returns {String} Formatted time string
 */
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format timestamp into date format
 * @param {Number} timestamp - Unix timestamp
 * @returns {String} Formatted date string
 */
export const formatTimestampDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Determine if a timestamp is in the past or future
 * @param {Number} timestamp - Unix timestamp
 * @returns {Boolean} True if timestamp is in the past
 */
export const isTimestampInPast = (timestamp) => {
  const now = Math.floor(Date.now() / 1000);
  return timestamp < now;
};

// Export default object with all methods
export default {
  fetchRadarData,
  generateTileUrl,
  formatTimestamp,
  formatTimestampDate,
  isTimestampInPast
};
