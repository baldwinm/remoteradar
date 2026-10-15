import { Link } from 'react-router';

import { Logo } from './Icon';

const SOURCES = [
  'Open-Meteo',
  'Google Places',
  'Booking.com',
  'OpenCage',
  'Speedtest® by Ookla®',
  'ExchangeRate-API',
  'Nager.Date',
];

export default function SiteFooter() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-top">
        <div className="ftr-brand">
          <Link to="/" className="logo">
            <Logo size={24} />
            Remote Radar
          </Link>
          <p>City guides for remote workers and travelers: weather, stays, internet and places to work.</p>
        </div>
        <nav aria-label="Explore">
          <h4>Explore</h4>
          <ul>
            <li>
              <Link to="/">Search cities</Link>
            </li>
            <li>
              <Link to="/compare">Compare cities</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="About">
          <h4>About</h4>
          <ul>
            <li>
              <Link to="/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link to="/privacy#contact">Contact</Link>
            </li>
          </ul>
        </nav>
        <div className="ftr-data">
          <h4>Data from</h4>
          <ul className="sources">
            {SOURCES.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ftr-bottom">
        <div className="wrap">
          <span>© {new Date().getFullYear()} Remote Radar</span>
        </div>
      </div>
    </footer>
  );
}
