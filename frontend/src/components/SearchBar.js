// src/components/SearchBar.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';

function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const debounceTimeoutRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Autocomplete city search with debouncing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debouncing
    debounceTimeoutRef.current = setTimeout(async () => {
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
        setIsOpen(true);
      } catch (err) {
        console.error('Search error:', err);
        setError('Error searching for cities. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce
    
    // Cleanup function
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // If we have results and the dropdown is open, select the first result
    if (results.length > 0 && isOpen) {
      handleCitySelect(results[0]);
    }
  };

  const handleCitySelect = (city) => {
    navigate(`/city/${city.id}`);
    setIsOpen(false);
    setResults([]);
    setQuery('');  // Clear the search input after selection
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  // Helper function to format location display
  const formatLocation = (city) => {
    const isUS = city.country === 'United States of America' || city.country_code === 'us';
    
    if (isUS && city.state) {
      return (
        <>
          <span className="city-name">{city.name}</span>
          <div className="location-details">
            <span className="city-state">{city.state}</span>
            <span className="city-country">USA</span>
          </div>
        </>
      );
    } else {
      return (
        <>
          <span className="city-name">{city.name}</span>
          <span className="city-country">{city.country}</span>
        </>
      );
    }
  };

  return (
    <div className="search-bar" ref={searchRef}>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Enter a city name..."
          className="search-input"
          aria-label="Search for a city"
          autoComplete="off"
        />
        <button type="submit" className="search-button" aria-label="Search">
          Search
        </button>
      </form>
      
      {loading && (
        <div className="search-loading">
          Searching...
        </div>
      )}
      
      {error && (
        <div className="search-error">
          {error}
        </div>
      )}
      
      {isOpen && results.length > 0 && (
        <div className="search-results">
          <ul>
            {results.map(city => (
              <li 
                key={city.id} 
                className="search-result-item"
                onClick={() => handleCitySelect(city)}
              >
                {formatLocation(city)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchBar;