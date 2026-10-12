import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { ApiError, type StayOptions, api } from '../api/client';
import { cityKeys, useCity, useEssentials, usePlaces, useStays, useWeather } from '../api/queries';
import type { City, Place, Units } from '../api/types';
import CityMap from '../components/CityMap';
import ClimateCard from '../components/ClimateCard';
import ErrorBoundary from '../components/ErrorBoundary';
import Icon from '../components/Icon';
import PlacesList, { type PlaceFilter, isExtraType } from '../components/PlacesList';
import Spinner from '../components/Spinner';
import StaysWidget, { localPrice } from '../components/StaysWidget';
import UnitsToggle from '../components/UnitsToggle';
import WeatherWidget from '../components/WeatherWidget';
import WorkPanel from '../components/WorkPanel';
import { defaultUnitsFor } from '../lib/cityId';
import { formatCoords, formatWholeMoney, round } from '../lib/format';
import { recordVisit, toRef, toggleSaved, useHomeZone, useSavedCities } from '../lib/savedCities';
import {
  browserTimeZone,
  clockIn,
  formatUtcOffset,
  isValidTimeZone,
  utcOffsetMinutes,
  workOverlap,
} from '../lib/time';
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

// Cities already counted toward the popular lists since this tab loaded the site, so
// re-renders and moving between cities and back don't count the same visit twice.
const counted = new Set<string>();

function countView(cityId: string) {
  if (counted.has(cityId)) return;
  counted.add(cityId);
  api.recordView(cityId, browserTimeZone());
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work from here' },
  { id: 'weather', label: 'Weather' },
  { id: 'climate', label: 'Best time to go' },
  { id: 'stays', label: 'Stays' },
  { id: 'places', label: 'Places' },
];

function CityView({ cityId }: { cityId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stayOptions, setStayOptions] = useState<StayOptions>({ occupants: 1, nights: 1 });
  const [placeFilter, setPlaceFilter] = useState<PlaceFilter>('all');
  const city = useCity(cityId);
  const essentials = useEssentials(cityId);
  const timeZone = city.data?.timezone || essentials.data?.timezone || '';

  const unitsParam = searchParams.get('units');
  const units: Units =
    unitsParam === 'metric' || unitsParam === 'imperial' ? unitsParam : defaultUnitsFor(cityId);

  useCanonicalUrl(cityId, city.data);

  useEffect(() => {
    if (!city.data) return;
    recordVisit(toRef(city.data));
    countView(city.data.id);
  }, [city.data]);

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
                {isValidTimeZone(timeZone) && <LocalClock timeZone={timeZone} />}
                {city.data.currency_code && (
                  <span>
                    {city.data.currency_name || city.data.currency_code}
                    {city.data.currency_symbol && city.data.currency_symbol !== city.data.currency_code
                      ? ` (${city.data.currency_symbol})`
                      : ''}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="city-actions">
            {city.data && <CityActions city={city.data} />}
            <UnitsToggle units={units} onChange={changeUnits} />
          </div>
        </div>
        <AtAGlance cityId={cityId} units={units} stayOptions={stayOptions} timeZone={timeZone} />
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
            <>
              <ErrorBoundary fallback={widgetFallback('work')}>
                <WorkPanel cityId={cityId} city={city.data} />
              </ErrorBoundary>
              <PlacesAndMap
                cityId={cityId}
                city={city.data}
                timeZone={timeZone}
                filter={placeFilter}
                onFilterChange={setPlaceFilter}
              />
            </>
          ) : (
            <div className="card">
              <Spinner label="Finding city…" />
            </div>
          )}
        </div>

        <div className="city-col">
          <ErrorBoundary fallback={widgetFallback('weather')}>
            <WeatherWidget cityId={cityId} units={units} />
          </ErrorBoundary>

          <ErrorBoundary fallback={widgetFallback('climate')}>
            <ClimateCard cityId={cityId} units={units} />
          </ErrorBoundary>

          <ErrorBoundary fallback={widgetFallback('accommodation')}>
            <StaysWidget
              cityId={cityId}
              options={stayOptions}
              onOptionsChange={setStayOptions}
              currency={essentials.data?.currency}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function PlacesAndMap({
  cityId,
  city,
  timeZone,
  filter,
  onFilterChange,
}: {
  cityId: string;
  city: City;
  timeZone: string;
  filter: PlaceFilter;
  onFilterChange: (filter: PlaceFilter) => void;
}) {
  const core = usePlaces(cityId);
  const extraType = isExtraType(filter) ? filter : undefined;
  // Gyms, parks and laundry are fetched only once someone picks them.
  const extra = usePlaces(cityId, extraType, extraType !== undefined);
  const places: Place[] = [...(core.data?.places ?? []), ...(extraType ? (extra.data?.places ?? []) : [])];
  const pinned = extraType ? (extra.data?.places ?? []) : (core.data?.places ?? []);

  return (
    <>
      <ErrorBoundary fallback={widgetFallback('map')}>
        <CityMap name={city.name} lat={city.lat} lng={city.lng} places={pinned} />
      </ErrorBoundary>
      <ErrorBoundary fallback={widgetFallback('places')}>
        <section className="card" id="places" aria-labelledby="places-title">
          {core.isPending ? (
            <>
              <div className="card-head">
                <h2 id="places-title">Places to work, eat and live</h2>
              </div>
              <div className="widget-loading">
                <div className="loading-spinner" aria-hidden="true" />
                <p>Loading places…</p>
              </div>
            </>
          ) : core.isError ? (
            <>
              <div className="card-head">
                <h2 id="places-title">Places to work, eat and live</h2>
              </div>
              <div className="widget-error">Places are unavailable right now. {core.error.message}</div>
            </>
          ) : (
            <PlacesList
              places={places}
              partial={core.data.partial}
              titleId="places-title"
              timeZone={timeZone}
              filter={filter}
              onFilterChange={onFilterChange}
              extraStatus={extra.status}
            />
          )}
        </section>
      </ErrorBoundary>
    </>
  );
}

function LocalClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span>
      <b className="city-clock">{clockIn(timeZone, now)}</b> local, {formatUtcOffset(utcOffsetMinutes(timeZone, now))}
    </span>
  );
}

function CityActions({ city }: { city: City }) {
  const saved = useSavedCities();
  const isSaved = saved.some((item) => item.id === city.id);
  const others = saved.filter((item) => item.id !== city.id).slice(0, 2);
  const compareIds = [city.id, ...others.map((item) => item.id)].map(encodeURIComponent).join(',');

  return (
    <>
      <button
        type="button"
        className="action-button"
        aria-pressed={isSaved}
        onClick={() => toggleSaved(toRef(city))}
      >
        <Icon name="bookmark" size={16} filled={isSaved} />
        {isSaved ? 'Saved' : 'Save'}
      </button>
      <Link to={`/compare?cities=${compareIds}`} className="action-button">
        <Icon name="compare" size={16} />
        Compare
      </Link>
    </>
  );
}

function AtAGlance({
  cityId,
  units,
  stayOptions,
  timeZone,
}: {
  cityId: string;
  units: Units;
  stayOptions: StayOptions;
  timeZone: string;
}) {
  // These reuse the cached responses the sections below fetch.
  const weather = useWeather(cityId, units);
  const places = usePlaces(cityId);
  const stays = useStays(cityId, stayOptions);
  const essentials = useEssentials(cityId);
  const homeZone = useHomeZone();
  const counts = places.data?.counts;
  const current = weather.data?.current;
  const icon = current ? weatherIcon(current.weather_code, current.is_day) : 'cloud';
  const tempUnit = weather.data?.units === 'imperial' ? '°F' : '°C';
  const guests = stayOptions.occupants === 1 ? '1 guest' : `${stayOptions.occupants} guests`;
  const overlap = isValidTimeZone(timeZone) ? workOverlap(homeZone, timeZone) : null;
  const fixed = essentials.data?.internet?.fixed;
  const local = localPrice(stays.data?.average_price, essentials.data?.currency);

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
        <dt>Work overlap</dt>
        <dd className="glance-value">{overlap ? `${Math.round((overlap.minutes / 60) * 10) / 10} h` : '–'}</dd>
        <dd className="glance-hint">
          {overlap ? `with your 9 to 5 (${homeZone.split('/').pop()?.replace(/_/g, ' ')})` : 'Local time unknown'}
        </dd>
      </div>
      <div className="glance-item">
        <dt>Internet</dt>
        <dd className="glance-value">{fixed ? `${Math.round(fixed.download_mbps)} Mbps` : '–'}</dd>
        <dd className="glance-hint">{fixed ? 'average home download' : essentials.isPending ? 'Loading' : 'No data'}</dd>
      </div>
      <div className="glance-item">
        <dt>Avg. nightly</dt>
        <dd className="glance-value">{formatWholeMoney(stays.data?.average_price, stays.data?.currency)}</dd>
        <dd className="glance-hint">{local ? `${local}, ${guests}` : `Hotels, ${guests}`}</dd>
      </div>
      <div className="glance-item">
        <dt>Coworking</dt>
        <dd className="glance-value">{counts?.coworking ?? '–'}</dd>
        <dd className="glance-hint">spaces nearby</dd>
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
