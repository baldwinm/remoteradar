import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { ApiError } from '../api/client';
import { cityKeys, useCity, usePlaces, useStays } from '../api/queries';
import type { City, Units } from '../api/types';
import CityMap from '../components/CityMap';
import ErrorBoundary from '../components/ErrorBoundary';
import PlacesList from '../components/PlacesList';
import Spinner from '../components/Spinner';
import StaysWidget from '../components/StaysWidget';
import WeatherWidget from '../components/WeatherWidget';
import { defaultUnitsFor } from '../lib/cityId';
import { formatMoney } from '../lib/format';
import './CityPage.css';

export default function CityPage() {
  const { cityId = '' } = useParams();
  // Keyed so every piece of per-city state resets when moving to another city.
  return <CityView key={cityId} cityId={cityId} />;
}

function widgetFallback(name: string) {
  return <div className="widget-error">The {name} section hit an unexpected error.</div>;
}

function CityView({ cityId }: { cityId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [occupants, setOccupants] = useState(1);
  const city = useCity(cityId);

  const unitsParam = searchParams.get('units');
  const units: Units =
    unitsParam === 'metric' || unitsParam === 'imperial' ? unitsParam : defaultUnitsFor(cityId);

  useCanonicalUrl(cityId, city.data);

  useEffect(() => {
    if (city.data) document.title = `${city.data.name} - Remote Radar`;
    return () => {
      document.title = 'Remote Radar - Find Your Perfect Remote Work Destination';
    };
  }, [city.data]);

  function changeUnits(next: Units) {
    setSearchParams(
      (params) => {
        params.set('units', next);
        return params;
      },
      { replace: true },
    );
  }

  if (city.isError) {
    const notFound = city.error instanceof ApiError && (city.error.status === 404 || city.error.status === 400);
    return (
      <div className="page-message">
        <h2>{notFound ? 'City not found' : "Couldn't load this city"}</h2>
        <p>{notFound ? 'Try searching for it again.' : city.error.message}</p>
        <Link to="/" className="button">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="city-page">
      <header className="city-header">
        {city.data ? (
          <>
            <h1 className="city-title">{city.data.name}</h1>
            <p className="city-subtitle">{[city.data.state, city.data.country].filter(Boolean).join(', ')}</p>
          </>
        ) : (
          <h1 className="city-title">Loading…</h1>
        )}
        <Link to="/" className="back-link">
          ← Back to search
        </Link>
      </header>

      {city.data ? (
        <ErrorBoundary fallback={widgetFallback('map')}>
          <CityMap name={city.data.name} lat={city.data.lat} lng={city.data.lng} />
        </ErrorBoundary>
      ) : (
        <Spinner label="Finding city…" />
      )}

      <ErrorBoundary fallback={widgetFallback('weather')}>
        <WeatherWidget
          cityId={cityId}
          cityName={city.data?.name ?? ''}
          units={units}
          onUnitsChange={changeUnits}
        />
      </ErrorBoundary>

      <div className="content-row">
        <div className="content-section">
          <ErrorBoundary fallback={widgetFallback('accommodation')}>
            <StaysWidget cityId={cityId} occupants={occupants} onOccupantsChange={setOccupants} />
          </ErrorBoundary>
        </div>
        <div className="content-section">
          <ErrorBoundary fallback={widgetFallback('places')}>
            <PlacesSection cityId={cityId} />
          </ErrorBoundary>
        </div>
      </div>

      <CitySummary cityId={cityId} cityName={city.data?.name ?? 'this city'} occupants={occupants} />

      <div className="support-container">
        <a
          href="https://www.buymeacoffee.com/remoteradar"
          target="_blank"
          rel="noopener noreferrer"
          className="coffee-button"
        >
          ☕ Buy me a coffee
        </a>
      </div>
    </div>
  );
}

function PlacesSection({ cityId }: { cityId: string }) {
  const { data, isPending, isError, error } = usePlaces(cityId);
  if (isPending) {
    return (
      <div className="widget-loading card">
        <div className="loading-spinner" aria-hidden="true" />
        <p>Loading places…</p>
      </div>
    );
  }
  if (isError) {
    return <div className="widget-error">Places are unavailable right now. {error.message}</div>;
  }
  return <PlacesList places={data.places} partial={data.partial} />;
}

function CitySummary({ cityId, cityName, occupants }: { cityId: string; cityName: string; occupants: number }) {
  // These reuse the cached responses the widgets above already fetched.
  const places = usePlaces(cityId);
  const stays = useStays(cityId, occupants);
  const counts = places.data?.counts;

  const stats = [
    { icon: '🏨', label: 'Avg. nightly', value: formatMoney(stays.data?.average_price, stays.data?.currency) },
    { icon: '☕', label: 'Coffee shops', value: counts?.coffee ?? '–' },
    { icon: '💻', label: 'Coworking spaces', value: counts?.coworking ?? '–' },
    { icon: '🍽️', label: 'Restaurants', value: counts?.restaurant ?? '–' },
  ];

  return (
    <section className="city-summary">
      <h3>About {cityName}</h3>
      <div className="summary-stats">
        {stats.map((stat) => (
          <div className="stat-item" key={stat.label}>
            <div className="stat-icon" aria-hidden="true">
              {stat.icon}
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Older links use IDs like "paris_fr"; once resolved, switch the URL to the city's current ID. */
function useCanonicalUrl(cityId: string, city: City | undefined) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!city || city.id === cityId) return;
    queryClient.setQueryData(cityKeys.city(city.id), city);
    navigate({ pathname: `/city/${encodeURIComponent(city.id)}`, search: location.search }, { replace: true });
  }, [city, cityId, location.search, navigate, queryClient]);
}
