// src/components/SearchBar.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';

function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search cities');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError('Error searching for cities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCitySelect = (city) => {
    navigate(`/city/${city.id}`);
    setResults([]);
    setQuery('');  // Clear the search input after selection
  };

  // Inline styles as a backup in case CSS isn't applied correctly
  const searchResultsStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '0 0 5px 5px',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    maxHeight: '300px',
    overflowY: 'auto'
  };

  const searchResultItemStyle = {
    padding: '0.8rem 1rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    color: '#333333',
    backgroundColor: 'white',
    fontSize: '0.9rem'
  };

  const cityNameStyle = {
    fontWeight: 'bold',
    color: '#333333',
    fontSize: '0.9rem'
  };

  const cityCountryStyle = {
    color: '#666666',
    fontSize: '0.8rem'
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a city name..."
          className="search-input"
        />
        <button type="submit" className="search-button">
          Search
        </button>
      </form>
      
      {loading && (
        <div className="search-loading" style={{ backgroundColor: 'white', color: '#333' }}>
          Searching...
        </div>
      )}
      
      {error && (
        <div className="search-error" style={{ backgroundColor: 'white', color: '#e74c3c' }}>
          {error}
        </div>
      )}
      
      {results.length > 0 && (
        <div className="search-results" style={searchResultsStyle}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {results.map(city => (
              <li 
                key={city.id} 
                className="search-result-item"
                style={searchResultItemStyle}
                onClick={() => handleCitySelect(city)}
              >
                <span className="city-name" style={cityNameStyle}>{city.name}</span>
                <span className="city-country" style={cityCountryStyle}>{city.country}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchBar;