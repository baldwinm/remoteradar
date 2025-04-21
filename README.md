# Remote Radar

## Project Overview

Remote Radar is a web application that allows users to explore city information, accommodations, and details using multiple API integrations.

## Tech Stack

- **Frontend**: React
- **Backend**: Flask
- **APIs**: 
  - OpenCage API
  - Google Places API
  - Airbnb API

## Features

- City search functionality
- Detailed city information
- Accommodation listings
- City map images

## Architecture

### Communication Flow

1. User interacts with React frontend
2. React components make API requests to Flask backend
3. Flask backend processes requests and interacts with external APIs
4. Backend returns data to frontend
5. React components render the data

### Performance Optimizations

- Code splitting with lazy loading
- Service Worker for caching and offline support
- Performance monitoring
- Error boundaries

## Routing

- `/`: Landing page with search functionality
- `/city/:cityId`: Detailed view of a specific city

## State Management

Utilizes React hooks:
- `useState`: Component-level state
- `useEffect`: Side effects like API calls
- `useParams`: Accessing route parameters

## Error Handling

### Frontend
- Error boundaries
- Loading states
- Error message displays
- Fallback UI

### Backend
- Exception handling
- Comprehensive logging
- Graceful degradation
- Custom error responses

## API Integration

- API keys stored in environment variables
- Backend acts as a proxy to protect API keys
- Rate limiting implemented

## Deployment Pipeline

1. Code pushed to version control
2. Automated tests run
3. Build process creates optimized assets
4. Deployment to staging environment
5. Manual verification
6. Deployment to production

## Future Enhancements

- User accounts with city favorites
- Advanced city filtering (cost of living, internet speed, etc.)

## Getting Started

### Prerequisites

- Node.js
- Python
- Flask
- React

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/remote-radar.git

# Install frontend dependencies
cd remote-radar/frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

# Set up environment variables
# Create a .env file with your API keys
```

### Running the Application

```bash
# Start backend server
cd backend
flask run

# Start frontend development server
cd frontend
npm start
```

## Environment Configuration

The application supports different configurations for development and production environments, including:
- API URLs
- Debug settings
- Application name

## License

MIT License

Copyright (c) [year] [fullname]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
