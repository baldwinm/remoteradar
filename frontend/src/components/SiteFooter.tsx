import { Link } from 'react-router';

import { CONTACT_EMAIL } from '../config';
import { Logo } from './Icon';

export default function SiteFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Link to="/" className="logo">
            <Logo size={22} />
            Remote Radar
          </Link>
          <p>City guides for remote workers and travelers: weather, stays, internet and places to work.</p>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <div>
            <h2>Explore</h2>
            <ul>
              <li>
                <Link to="/">Search cities</Link>
              </li>
              <li>
                <Link to="/compare">Compare cities</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>About</h2>
            <ul>
              <li>
                <Link to="/privacy">Privacy policy</Link>
              </li>
              {CONTACT_EMAIL && (
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
                </li>
              )}
            </ul>
          </div>
        </nav>
      </div>

      <div className="footer-bottom">
        <div className="footer-content">
          <span>© {new Date().getFullYear()} Remote Radar</span>
          <span>
            Data from Open-Meteo, Google Places, Booking.com, OpenCage, Speedtest® by Ookla®, ExchangeRate-API,
            Nager.Date and the US State Department
          </span>
        </div>
      </div>
    </footer>
  );
}
