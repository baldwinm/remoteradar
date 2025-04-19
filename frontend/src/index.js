import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Create a root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for caching and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceWorker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Add performance monitoring
if ('performance' in window && 'measure' in window.performance && 'mark' in window.performance) {
  // Mark the start of the application
  performance.mark('app-start');
  
  // After the app loads, measure and log the performance
  window.addEventListener('load', () => {
    performance.mark('app-loaded');
    performance.measure('app-load-time', 'app-start', 'app-loaded');
    
    const loadTime = performance.getEntriesByName('app-load-time')[0].duration;
    console.log(`App loaded in ${loadTime.toFixed(2)}ms`);
  });
}