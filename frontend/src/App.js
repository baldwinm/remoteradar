// src/App.js
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Lazy load page components for better initial load time
const HomePage = lazy(() => import('./pages/HomePage'));
const CityDetailPage = lazy(() => import('./pages/CityDetailPage'));

// Simple loading component
const Loading = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <Link to="/" className="logo">Remote Radar</Link>
          </div>
        </header>
        
        <main className="app-content">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/city/:cityId" element={<CityDetailPage />} />
            </Routes>
          </Suspense>
        </main>
        
        <footer className="app-footer">
          <div className="footer-content">
            <p>Remote Radar - Find your perfect remote work destination</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;