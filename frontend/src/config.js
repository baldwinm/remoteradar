// config.js
// Configuration file for environment-specific settings

// Define environment configurations
const environments = {
  development: {
    API_URL: 'http://localhost:5000',
    MAPS_API_KEY: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    DEBUG: true,
    APP_NAME: 'Remote Radar (Dev)'
  },
  production: {
    API_URL: 'https://remote-radar-backend.onrender.com', // Updated to match hardcoded URL
    MAPS_API_KEY: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    DEBUG: false,
    APP_NAME: 'Remote Radar'
  },
  // You can add more environments if needed (staging, testing, etc.)
};

// Determine current environment
const getEnvironment = () => {
  // Check if we're running in a production build
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // Default to development
  return 'development';
};

// Export the configuration for the current environment
const currentEnv = getEnvironment();
const config = environments[currentEnv];

// Add environment name for reference
config.ENVIRONMENT = currentEnv;

// Add version for reference
config.VERSION = process.env.REACT_APP_VERSION || '1.0.0';

// Helper function to get API endpoints
config.getApiUrl = (endpoint) => {
  // Make sure endpoint starts with a slash if it doesn't already
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${config.API_URL}/api${formattedEndpoint}`;
};

// Examples of common API endpoints
config.endpoints = {
  CITIES_SEARCH: (query) => config.getApiUrl(`/cities?q=${encodeURIComponent(query)}`),
  PLACES: (cityId) => config.getApiUrl(`/places/${cityId}`),
  PLACES_FILTERED: (cityId, type) => config.getApiUrl(`/places/${cityId}?type=${type}`),
  ACCOMMODATION: (cityId, occupants = 1) => config.getApiUrl(`/accommodation/${cityId}?occupants=${occupants}`),
  PLACE_DETAILS: (placeId) => config.getApiUrl(`/place-details/${placeId}`),
  // Add weather endpoint
  WEATHER: (cityId, units = 'metric') => config.getApiUrl(`/weather/${cityId}?units=${units}`),
};

export default config;
