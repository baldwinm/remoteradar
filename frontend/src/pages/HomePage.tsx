import SearchBar from '../components/SearchBar';
import './HomePage.css';

const FEATURES = [
  {
    icon: '🏨',
    title: 'Accommodations',
    text: 'Find affordable and comfortable places to stay while working remotely.',
  },
  {
    icon: '☕',
    title: 'Coffee & Coworking',
    text: 'Discover the best coffee shops and coworking spaces to boost your productivity.',
  },
  {
    icon: '🍽️',
    title: 'Restaurants',
    text: 'Explore top-rated restaurants and local cuisine in each destination.',
  },
  {
    icon: '📊',
    title: 'Location Insights',
    text: 'Get helpful statistics about each city to make informed decisions.',
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <h1 className="hero-title">Find Your Perfect Remote Work Destination</h1>
        <p className="hero-subtitle">
          Discover cities with great accommodations and amenities for remote work
        </p>
        <SearchBar />
      </section>

      <section className="features-section">
        <h2 className="features-title">Why Use Remote Radar?</h2>
        <div className="features-grid">
          {FEATURES.map((feature) => (
            <div className="feature-card" key={feature.title}>
              <div className="feature-icon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
