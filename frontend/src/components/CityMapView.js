import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './CityMapView.css';

const CityMapView = ({ 
  city, 
  lat, 
  lng, 
  mapboxToken 
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [zoom, setZoom] = useState(12);
  const [style, setStyle] = useState('streets-v11');

  // Mapbox styles available
  const mapStyles = [
    { id: 'streets-v11', name: 'Street Map' },
    { id: 'satellite-v9', name: 'Satellite' },
    { id: 'satellite-streets-v11', name: 'Satellite with Streets' },
    { id: 'light-v10', name: 'Light' },
    { id: 'dark-v10', name: 'Dark' },
    { id: 'outdoors-v11', name: 'Outdoors' }
  ];

  useEffect(() => {
    // Prevent multiple map initializations
    if (map.current) return;

    // Set Mapbox access token
    mapboxgl.accessToken = mapboxToken;

    // Create map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: `mapbox://styles/mapbox/${style}`,
      center: [lng, lat],
      zoom: zoom
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Add marker for city
    new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .addTo(map.current);

    // Clean up on unmount
    return () => map.current?.remove();
  }, [lng, lat, style, mapboxToken]);

  // Handle style change
  const handleStyleChange = (newStyle) => {
    if (map.current) {
      map.current.setStyle(`mapbox://styles/mapbox/${newStyle}`);
      setStyle(newStyle);
    }
  };

  // Handle zoom change
  const handleZoomChange = (direction) => {
    if (map.current) {
      const currentZoom = map.current.getZoom();
      const newZoom = direction === 'in' 
        ? Math.min(currentZoom + 1, 20) 
        : Math.max(currentZoom - 1, 2);
      
      map.current.zoomTo(newZoom);
      setZoom(newZoom);
    }
  };

  return (
    <div className="city-map-container">
      <div 
        ref={mapContainer} 
        className="map-container" 
      />
      
      <div className="map-controls">
        <div className="map-style-selector">
          <label>Map Style:</label>
          <select 
            value={style} 
            onChange={(e) => handleStyleChange(e.target.value)}
          >
            {mapStyles.map((mapStyle) => (
              <option key={mapStyle.id} value={mapStyle.id}>
                {mapStyle.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="map-zoom-controls">
          <button onClick={() => handleZoomChange('out')}>-</button>
          <span>Zoom: {zoom.toFixed(1)}</span>
          <button onClick={() => handleZoomChange('in')}>+</button>
        </div>
      </div>
    </div>
  );
};

export default CityMapView;