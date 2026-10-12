import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { ApiError } from '../api/client';
import { cityKeys, useCity, usePlaces, useStays, useWeather } from '../api/queries';
import type { City, Units } from '../api/types';
import { SUPPORT_URL } from '../config';
import CityMap from '../components/CityMap';
import ErrorBoundary from '../components/ErrorBoundary';
import Icon from '../components/Icon';
import PlacesList from '../components/PlacesList';
import Spinner from '../components/Spinner';
import StaysWidget from '../components/StaysWidget';
import UnitsToggle from '../components/UnitsToggle';
import WeatherWidget from '../components/WeatherWidget';
import { defaultUnitsFor } from '../lib/cityId';
import { formatCoords, formatWholeMoney, round } from '../lib/format';
import { isSunny, weatherIcon } from '../lib/weatherIcons';
import './CityPage.css';

export default function CityPage() {
  const { cityId = '' } = useParams();
  // Keyed so every piece of per-city state resets when moving to another city.
  return <CityView key={cityId} cityId={cityId} />;
}

function widgetFallback(name: string) {
  return (
    <div className="card">
      <div className="widget-error">The {name} section hit an unexpected error.</div>
    </div>
  );
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'weather', label: 'Weather' },
  { id: 'stays', label: 'Stays' },
  { id: 'places', label: 'Places' },
];

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
      <section className="city-hero" id="overview">
        <div className="city-title-row">
          <div className="city-heading">
            <h1 className="city-title">{city.data?.name ?? 'Loading…'}</h1>
            {city.data && (
              <p className="city-sub">
                <span>{[city.data.state, city.data.country].filter(Boolean).join(', ')}</span>
                <span className="mono">{formatCoords(city.data.lat, city.data.lng)}</span>
              </p>
            )}
          </div>
          <UnitsToggle units={units} onChange={changeUnits} />
        </div>
        <AtAGlance cityId={cityId} units={units} occupants={occupants} />
      </section>

      <nav className="section-nav" aria-label="Sections">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.label}
          </a>
        ))}
      </nav>

      <div className="city-grid">
        <div className="city-col">
          {city.data ? (
            <ErrorBoundary fallback={widgetFallback('map')}>
              <CityMapWithPlaces cityId={cityId} city={city.data} />
            </ErrorBoundary>
          ) : (
            <div className="card">
              <Spinner label="Finding city…" />
            </div>
          )}

          <ErrorBoundary fallback={widgetFallback('places')}>
            <PlacesSection cityId={cityId} />
          </ErrorBoundary>
        </div>

        <div className="city-col">
          <ErrorBoundary fallback={widgetFallback('weather')}>
            <WeatherWidget cityId={cityId} units={units} />
          </ErrorBoundary>

          <ErrorBoundary fallback={widgetFallback('accommodation')}>
            <StaysWidget cityId={cityId} occupants={occupants} onOccupantsChange={setOccupants} />
          </ErrorBoundary>
        </div>
      </div>

      <aside className="support-band">
        <span>Remote Radar is free and ad-free. If it helped you pick a city, you can chip in.</span>
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="button button-quiet">
          Buy me a coffee
        </a>
      </aside>
    </div>
  );
}

function CityMapWithPlaces({ cityId, city }: { cityId: string; city: City }) {
  const places = usePlaces(cityId);
  return (
    <CityMap name={city.name} lat={city.lat} lng={city.lng} places={places.data?.places ?? []} />
  );
}

function PlacesSection({ cityId }: { cityId: string }) {
  const { data, isPending, isError, error } = usePlaces(cityId);
  return (
    <section className="card" id="places" aria-labelledby="places-title">
      {isPending ? (
        <>
          <div className="card-head">
            <h2 id="places-title">Places to work and eat</h2>
          </div>
          <div className="widget-loading">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Loading places…</p>
          </div>
        </>
      ) : isError ? (
        <>
          <div className="card-head">
            <h2 id="places-title">Places to work and eat</h2>
          </div>
          <div className="widget-error">Places are unavailable right now. {error.message}</div>
        </>
      ) : (
        <PlacesList places={data.places} partial={data.partial} titleId="places-title" />
      )}
    </section>
  );
}

function AtAGlance({ cityId, units, occupants }: { cityId: string; units: Units; occupants: number }) {
  // These reuse the cached responses the sections below fetch.
  const weather = useWeather(cityId, units);
  const places = usePlaces(cityId);
  const stays = useStays(cityId, occupants);
  const counts = places.data?.counts;
  const current = weather.data?.current;
  const icon = current ? weatherIcon(current.weather_code, current.is_day) : 'cloud';
  const tempUnit = weather.data?.units === 'imperial' ? '°F' : '°C';
  const guests = occupants === 1 ? '1 guest' : `${occupants} guests`;

  return (
    <dl className="glance">
      <div className="glance-item glance-now">
        <Icon name={icon} size={34} className={current && isSunny(icon) ? 'glance-icon sunny' : 'glance-icon'} />
        <div>
          <dt>Now</dt>
          <dd className="glance-value">{current ? `${round(current.temperature)}${tempUnit}` : '–'}</dd>
          <dd className="glance-hint">{current?.description ?? 'Loading weather'}</dd>
        </div>
      </div>
      <div className="glance-item">
        <dt>Avg. nightly</dt>
        <dd className="glance-value">{formatWholeMoney(stays.data?.average_price, stays.data?.currency)}</dd>
        <dd className="glance-hint">Hotels, {guests}</dd>
      </div>
      <div className="glance-item">
        <dt>Coffee</dt>
        <dd className="glance-value">{counts?.coffee ?? '–'}</dd>
        <dd className="glance-hint">shops nearby</dd>
      </div>
      <div className="glance-item">
        <dt>Coworking</dt>
        <dd className="glance-value">{counts?.coworking ?? '–'}</dd>
        <dd className="glance-hint">spaces nearby</dd>
      </div>
      <div className="glance-item">
        <dt>Restaurants</dt>
        <dd className="glance-value">{counts?.restaurant ?? '–'}</dd>
        <dd className="glance-hint">top rated</dd>
      </div>
    </dl>
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
