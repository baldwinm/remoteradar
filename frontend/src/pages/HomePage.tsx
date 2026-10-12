import { Link } from 'react-router';

import Icon, { type IconName } from '../components/Icon';
import SearchBar from '../components/SearchBar';
import './HomePage.css';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'cloud-sun',
    title: 'Weather',
    text: 'Conditions now, the next 24 hours, and a 3-day outlook in °F or °C.',
  },
  {
    icon: 'bed',
    title: 'Where to stay',
    text: "Tonight's average hotel price and the best-rated options, sorted how you like.",
  },
  {
    icon: 'desk',
    title: 'Places to work',
    text: 'Coffee shops and coworking spaces with ratings, reviews and directions.',
  },
  {
    icon: 'food',
    title: 'Places to eat',
    text: 'Top-rated restaurants, filterable by budget from $ to $$$$.',
  },
];

// Name + country IDs; the city page resolves them and switches to the full ID.
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
            Weather, hotel prices, coffee shops, coworking spaces and places to eat, on one page for any city in
            the world.
          </p>
          <SearchBar />
          <div className="popular">
            <span className="popular-label">Popular:</span>
            {POPULAR.map((city) => (
              <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} className="chip">
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

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
