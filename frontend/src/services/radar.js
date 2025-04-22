// src/services/radar.js
/**
 * Service for handling RainViewer API requests
 */

// RainViewer API base URL
const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';

/**
 * Fetch available radar frames from RainViewer API
 * @returns {Promise<Object>} Available frames data
 */
export const fetchRadarFrames = async () => {
  try {
    const response = await fetch(RAINVIEWER_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch radar data: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching radar data:', error);
    throw error;
  }
};

/**
 * Format the radar API data into a more usable format for our application
 * @param {Object} apiData - The raw API data from RainViewer
 * @returns {Object} Formatted radar data
 */
export const formatRadarData = (apiData) => {
  if (!apiData) return null;

  // Extract past frames
  const pastFrames = apiData.radar?.past || [];
  
  // Extract nowcast (forecast) frames
  const forecastFrames = apiData.radar?.nowcast || [];
  
  // Combine into a single object
  return {
    host: apiData.host || '',
    radar: {
      past: pastFrames.map(frame => ({
        time: frame.time,
        path: frame.path
      })),
      nowcast: forecastFrames.map(frame => ({
        time: frame.time,
        path: frame.path
      }))
    }
  };
};

/**
 * Generate radar tile URL
 * @param {String} host - The host from API data
 * @param {String} path - The path for the specific frame
 * @param {Number} x - Tile X coordinate
 * @param {Number} y - Tile Y coordinate
 * @param {Number} z - Zoom level
 * @param {Object} options - Additional options
 * @returns {String} URL for the radar tile
 */
export const generateRadarTileUrl = (host, path, x, y, z, options = {}) => {
  const {
    colorScheme = 2, // Default color scheme (2 is a good general-purpose scheme)
    smoothData = 1,  // Smooth the data (0 - not smooth, 1 - smooth)
    snowColors = 1,  // Show snow colors (0 - don't show, 1 - show)
    tileSize = 256,  // Tile size (256 or 512)
    format = 'webp'  // Image format (webp or png)
  } = options;
  
  return `${host}${path}/${tileSize}/${z}/${x}/${y}/${colorScheme}/${smoothData}_${snowColors}.${format}`;
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
  fetchRadarFrames,
  formatRadarData,
  generateRadarTileUrl,
  formatTimestamp,
  formatTimestampDate,
  isTimestampInPast
};
