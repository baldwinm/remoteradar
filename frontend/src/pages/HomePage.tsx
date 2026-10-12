import { Link } from 'react-router';

import { usePopularCities, useWeather } from '../api/queries';
import Icon, { type IconName } from '../components/Icon';
import SearchBar from '../components/SearchBar';
import { defaultUnitsFor } from '../lib/cityId';
import { round } from '../lib/format';
import { type CityRef, toggleSaved, useRecentCities, useSavedCities } from '../lib/savedCities';
import { browserTimeZone, clockIn, isValidTimeZone } from '../lib/time';
import './HomePage.css';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'cloud-sun',
    title: 'Weather',
    text: 'Conditions now, the next 24 hours, a 3-day outlook and daylight hours in °F or °C.',
  },
  {
    icon: 'bed',
    title: 'Where to stay',
    text: 'Average hotel prices for your dates, from one night to a month, in dollars and local money.',
  },
  {
    icon: 'desk',
    title: 'Places to work',
    text: 'Coffee shops and coworking spaces with ratings, opening hours and directions.',
  },
  {
    icon: 'food',
    title: 'Places to eat and live',
    text: 'Restaurants by budget, plus gyms, parks and laundromats when you need them.',
  },
  {
    icon: 'clock',
    title: 'Your working hours',
    text: 'Local time and how many hours overlap with your 9 to 5 back home.',
  },
  {
    icon: 'wifi',
    title: 'Internet speed',
    text: 'Typical home and mobile speeds, from millions of real speed tests.',
  },
  {
    icon: 'calendar',
    title: 'Best time to go',
    text: 'Five years of weather by month, with the mildest, driest months marked.',
  },
  {
    icon: 'cash',
    title: 'Money and holidays',
    text: 'The local currency and exchange rate, public holidays and travel advisories.',
  },
];

// Shown until enough people have searched to build a live list. Name + country IDs;
// the city page resolves them and switches to the full ID.
const POPULAR = [
  { id: 'lisbon--pt', name: 'Lisbon' },
  { id: 'mexico-city--mx', name: 'Mexico City' },
  { id: 'chiang-mai--th', name: 'Chiang Mai' },
  { id: 'medellín--co', name: 'Medellín' },
  { id: 'tbilisi--ge', name: 'Tbilisi' },
];

function RadarRings() {
  return (
    <svg className="hero-rings" viewBox="0 0 520 520" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor">
        <circle cx="260" cy="260" r="80" strokeOpacity=".16" />
        <circle cx="260" cy="260" r="150" strokeOpacity=".16" />
        <circle cx="260" cy="260" r="220" strokeOpacity=".16" />
        <path d="M260 20v480M20 260h480" strokeOpacity=".08" />
      </g>
      <path d="M260 260 L260 40 A220 220 0 0 1 450 150 Z" fill="currentColor" fillOpacity=".05" />
      <circle cx="372" cy="170" r="6" fill="var(--signal)" />
      <circle cx="190" cy="352" r="4" fill="currentColor" fillOpacity=".5" />
      <circle cx="330" cy="330" r="4" fill="currentColor" fillOpacity=".3" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <RadarRings />
        <div className="hero-inner">
          <span className="eyebrow">For remote workers and travelers</span>
          <h1 className="hero-title">Scope out your next city before you book.</h1>
          <p className="hero-lede">
            Weather, hotel prices, internet speed, coworking spaces, time zone overlap and more, on one page for any
            city in the world.
          </p>
          <SearchBar />
          <PopularCities />
        </div>
      </section>

      <YourCities />

      <section className="features-section" aria-labelledby="features-title">
        <div className="section-head">
          <h2 id="features-title">Everything on one page</h2>
          <p>Each city page pulls live data from a few trusted sources.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.title}>
              <span className="icon-tile">
                <Icon name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Country names that read naturally after "in the".
const NEEDS_THE = new Set(['US', 'GB', 'NL', 'PH', 'AE', 'DO', 'BS', 'GM', 'MV', 'CF', 'KY']);

function countryPhrase(code: string): string {
  let name = code;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    // Very old browsers: fall back to the code itself.
  }
  return NEEDS_THE.has(code) ? `the ${name}` : name;
}

function PopularCities() {
  const live = usePopularCities(browserTimeZone()).data;
  const hasLive = Boolean(live && live.cities.length > 0);
  const cities = hasLive && live ? live.cities : POPULAR;

  return (
    <div className="popular">
      <span className="popular-label">
        {hasLive && live?.scope === 'country' ? (
          <>
            Popular in <b>{countryPhrase(live.country_code)}</b>:
          </>
        ) : hasLive && live?.scope === 'site' ? (
          'Popular on Remote Radar:'
        ) : (
          'Popular:'
        )}
      </span>
      {cities.map((city) => (
        <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} className="chip">
          {city.name}
        </Link>
      ))}
    </div>
  );
}

function YourCities() {
  const saved = useSavedCities();
  const recent = useRecentCities().filter((city) => !saved.some((item) => item.id === city.id));
  if (saved.length === 0 && recent.length === 0) return null;

  const compareIds = saved
    .slice(0, 3)
    .map((city) => encodeURIComponent(city.id))
    .join(',');

  return (
    <section className="your-cities" aria-label="Your cities">
      {saved.length > 0 && (
        <>
          <div className="your-cities-head">
            <h2>Your saved cities</h2>
            {saved.length > 1 && (
              <Link to={`/compare?cities=${compareIds}`} className="action-link">
                <Icon name="compare" size={16} />
                Compare {saved.length > 3 ? 'first 3' : 'them'}
              </Link>
            )}
          </div>
          <ul className="saved-grid">
            {saved.map((city) => (
              <SavedCityCard key={city.id} city={city} />
            ))}
          </ul>
        </>
      )}
      {recent.length > 0 && (
        <div className="recent-row">
          <h2>Recently viewed</h2>
          <div className="recent-chips">
            {recent.map((city) => (
              <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} className="chip">
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      <p className="your-cities-note">Saved and recent cities are kept in this browser only. No account needed.</p>
    </section>
  );
}

function SavedCityCard({ city }: { city: CityRef }) {
  const units = defaultUnitsFor(city.id);
  const weather = useWeather(city.id, units);
  const current = weather.data?.current;
  const zone = city.timezone && isValidTimeZone(city.timezone) ? city.timezone : weather.data?.timezone;

  return (
    <li className="saved-card">
      <Link to={`/city/${encodeURIComponent(city.id)}`} className="saved-card-link">
        <b>{city.name}</b>
        <span className="saved-card-meta">
          {[city.country, zone && isValidTimeZone(zone) ? clockIn(zone) : ''].filter(Boolean).join(' · ')}
        </span>
        <span className="saved-card-weather">
          {current ? `${round(current.temperature)}°${units === 'imperial' ? 'F' : 'C'}, ${current.description}` : ' '}
        </span>
      </Link>
      <button
        type="button"
        className="saved-card-remove"
        aria-label={`Remove ${city.name} from saved cities`}
        onClick={() => toggleSaved(city)}
      >
        ×
      </button>
    </li>
  );
}
