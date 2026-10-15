import { useEffect } from 'react';
import { Link } from 'react-router';

import { Logo } from '../components/Icon';
import { openSearch } from '../components/Search';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found - Remote Radar';
    return () => {
      document.title = 'Remote Radar - Find Your Perfect Remote Work Destination';
    };
  }, []);

  return (
    <div className="wrap page-state">
      <div className="card state-card center">
        <span className="state-ic radar">
          <Logo size={72} />
        </span>
        <h1>Page not found</h1>
        <p>Nothing is on the radar at this address. Search for a city instead.</p>
        <div className="acts">
          <button type="button" className="btn btn-primary" onClick={() => openSearch()}>
            Search cities
          </button>
          <Link to="/" className="btn btn-secondary">
            Go to the home page
          </Link>
        </div>
      </div>
    </div>
  );
}
