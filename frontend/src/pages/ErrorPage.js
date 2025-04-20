// src/pages/ErrorPage.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './ErrorPage.css';

function ErrorPage() {
  const location = useLocation();

  // Extract potential error information from location state
  const errorMessage = location.state?.error || 'An unexpected error occurred';

  return (
    <div className="error-page">
      <div className="error-container">
        <h1>Oops! Something went wrong</h1>
        <p>{errorMessage}</p>
        <div className="error-actions">
          <Link to="/" className="back-to-home">
            Return to Home
          </Link>
          <button 
            onClick={() => window.location.reload()} 
            className="retry-button"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorPage;