// src/components/LeafletTest.js
import React, { useEffect, useRef } from 'react';

const LeafletTest = () => {
  const mapRef = useRef(null);
  
  useEffect(() => {
    // Add Leaflet CSS directly to head
    const linkExists = document.querySelector('link[href*="leaflet"]');
    if (!linkExists) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
      link.integrity = 'sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==';
      link.crossOrigin = '';
      document.head.appendChild(link);
      console.log("Leaflet CSS added to head");
    }
    
    // Load Leaflet JS directly
    const scriptExists = document.querySelector('script[src*="leaflet"]');
    if (!scriptExists) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
      script.integrity = 'sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==';
      script.crossOrigin = '';
      script.onload = initMap;
      document.body.appendChild(script);
      console.log("Leaflet script added to body");
    } else {
      console.log("Leaflet script already exists");
      // Wait a bit and then try to init map
      setTimeout(initMap, 500);
    }
    
    function initMap() {
      console.log("initMap called");
      console.log("window.L exists:", !!window.L);
      
      if (!window.L) {
        console.error("Leaflet not loaded");
        return;
      }
      
      if (!mapRef.current) {
        console.error("Map container not found");
        return;
      }
      
      try {
        console.log("Creating map with container dimensions:", {
          width: mapRef.current.offsetWidth,
          height: mapRef.current.offsetHeight
        });
        
        // Ensure the container has a height
        mapRef.current.style.height = '400px';
        mapRef.current.style.width = '100%';
        mapRef.current.style.border = '2px solid red';
        
        // Create map
        const map = window.L.map(mapRef.current, {
          center: [39.8283, -98.5795],
          zoom: 5,
          zoomControl: true,
          attributionControl: true
        });
        
        // Add OpenStreetMap tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        // Add a marker
        window.L.marker([39.8283, -98.5795])
          .addTo(map)
          .bindPopup('Leaflet Test Works!')
          .openPopup();
        
        console.log("Map created successfully");
        
        // Force a resize
        setTimeout(() => {
          if (map) {
            console.log("Forcing map resize");
            map.invalidateSize(true);
          }
        }, 500);
      } catch (error) {
        console.error("Error creating map:", error);
      }
    }
    
    return () => {
      console.log("Cleanup");
    };
  }, []);
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Leaflet Test</h2>
      <p>This component tests basic Leaflet functionality.</p>
      
      <div 
        ref={mapRef} 
        id="test-map"
        style={{ 
          height: '400px', 
          width: '100%', 
          border: '2px solid blue',
          marginTop: '20px'
        }}
      ></div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Debug Info</h3>
        <button 
          onClick={() => {
            console.log("Leaflet available:", !!window.L);
            console.log("Map container:", mapRef.current);
            if (mapRef.current) {
              console.log("Container dimensions:", {
                width: mapRef.current.offsetWidth,
                height: mapRef.current.offsetHeight,
                clientWidth: mapRef.current.clientWidth,
                clientHeight: mapRef.current.clientHeight
              });
            }
          }}
          style={{ padding: '8px 16px' }}
        >
          Log Debug Info
        </button>
      </div>
    </div>
  );
};

export default LeafletTest;