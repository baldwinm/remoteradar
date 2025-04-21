// src/components/WeatherErrorBoundary.js
import React from 'react';

class WeatherErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Weather Widget Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="weather-widget error">
          <div className="error-icon">⚠️</div>
          <p>Weather Widget Error</p>
          <div className="error-details">
            {this.state.error && this.state.error.toString()}
          </div>
          <button 
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }} 
            className="retry-button"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WeatherErrorBoundary;
