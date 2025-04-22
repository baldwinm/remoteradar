// src/pages/HomePage.js
import React from 'react';
import SearchBar from '../components/SearchBar';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1 className="hero-title">Find Your Perfect Remote Work Destination</h1>
        <p className="hero-subtitle">
          Discover cities with great accommodations and amenities for remote work
        </p>
        <div className="search-wrapper">
          <SearchBar />
        </div>
      </div>

      <div className="features-section">
        <h2 className="section-title">Why Use Remote Radar?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🏨</div>
            <h3 className="feature-title">Accommodations</h3>
            <p className="feature-description">
              Find affordable and comfortable places to stay while working remotely.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">☕</div>
            <h3 className="feature-title">Coffee & Coworking</h3>
            <p className="feature-description">
              Discover the best coffee shops and coworking spaces to boost your productivity.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🍽️</div>
            <h3 className="feature-title">Restaurants</h3>
            <p className="feature-description">
              Explore top-rated restaurants and local cuisine in each destination.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3 className="feature-title">Location Insights</h3>
            <p className="feature-description">
              Get helpful statistics about each city to make informed decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;