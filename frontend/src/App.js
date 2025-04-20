// src/App.js
import React, { lazy, Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  Navigate 
} from 'react-router-dom';
import './App.css';

// Lazy load page components for better initial load time
const HomePage = lazy(() => import('./pages/HomePage'));
const CityDetailPage = lazy(() => import('./pages/CityDetailPage'));
const ErrorPage = lazy(() => import('./pages/ErrorPage')); // New error page

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
              
              {/* Catch-all route */}
              <Route path="/error" element={<ErrorPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
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