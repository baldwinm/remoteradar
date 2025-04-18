// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CityDetailPage from './pages/CityDetailPage';
import './App.css';

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/city/:cityId" element={<CityDetailPage />} />
          </Routes>
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