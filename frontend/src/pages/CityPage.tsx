import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { ApiError, type StayOptions, api } from '../api/client';
import { cityKeys, useCity, useEssentials } from '../api/queries';
import type { City } from '../api/types';
import ErrorBoundary from '../components/ErrorBoundary';
import Icon from '../components/Icon';
import { openSearch } from '../components/Search';
import CityHero, { HeroSkeleton } from '../components/city/CityHero';
import CityTabs, { PhoneActionBar } from '../components/city/CityTabs';
import ClimateSection from '../components/city/ClimateSection';
import PlacesSection from '../components/city/PlacesSection';
import StaysSection from '../components/city/StaysSection';
import WeatherSection from '../components/city/WeatherSection';
import WorkSection from '../components/city/WorkSection';
import { goToSection, isSectionId } from '../components/city/common';
import { recordVisit, toRef } from '../lib/savedCities';
import { browserTimeZone, isValidTimeZone } from '../lib/time';
import { usePageUnits } from '../lib/units';

const DEFAULT_TITLE = 'Remote Radar - Find Your Perfect Remote Work Destination';

export default function CityPage() {
  const { cityId = '' } = useParams();
  // Keyed so every piece of per-city state resets when moving to another city.
  return <CityView key={cityId} cityId={cityId} />;
}

// Cities already counted toward the popular lists since this tab loaded the site, so re-renders
// and moving between cities and back don't count the same visit twice.
const counted = new Set<string>();

function countView(cityId: string) {
  if (counted.has(cityId)) return;
  counted.add(cityId);
  api.recordView(cityId, browserTimeZone());
}

/** What a section shows if it crashes, so the rest of the page keeps working. */
function sectionFallback(name: string): ReactNode {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="card">
          <div className="state-card center">
            <span className="state-ic warn">
              <Icon name="alert" size={22} />
            </span>
            <h2>The {name} section hit a problem</h2>
            <p>Everything else on this page still works. Reloading usually fixes it.</p>
            <div className="acts">
              <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
                <Icon name="refresh" size={16} />
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CityView({ cityId }: { cityId: string }) {
  const city = useCity(cityId);
  const data = city.data;
  // Sections load with the city's full ID. A full ID (city--region--country) can start right away;
  // an older or shorter link waits for the city, so its sections don't load twice.
  const dataId = data ? (data.id === cityId ? cityId : '') : cityId.split('--').length >= 3 ? cityId : '';
  const essentials = useEssentials(dataId);
  const found = data?.timezone || essentials.data?.timezone || '';
  const zone = isValidTimeZone(found) ? found : 'UTC';
  const [units] = usePageUnits();
  const [stay, setStay] = useState<StayOptions>({ occupants: 1, nights: 1 });
  const { hash } = useLocation();

  useCanonicalUrl(cityId, data);

  useEffect(() => {
    if (!data || data.id !== cityId) return;
    recordVisit(toRef(data));
    countView(data.id);
  }, [data, cityId]);

  useEffect(() => {
    if (data) document.title = `${data.name} - Remote Radar`;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [data]);

  // A link to a section (/city/lisbon--lisbon--pt#stays) opens at that section.
  useEffect(() => {
    const id = hash.slice(1);
    if (!data || !isSectionId(id)) return;
    const frame = requestAnimationFrame(() => goToSection(id, false));
    return () => cancelAnimationFrame(frame);
  }, [data, hash]);

  if (city.isError) {
    const notFound = city.error instanceof ApiError && (city.error.status === 404 || city.error.status === 400);
    return (
      <div className="wrap page-state">
        <div className="card state-card center">
          <span className={notFound ? 'state-ic' : 'state-ic warn'}>
            <Icon name={notFound ? 'search' : 'alert'} size={22} />
          </span>
          <h1>{notFound ? 'City not found' : "Couldn't load this city"}</h1>
          <p>
            {notFound
              ? "This link doesn't match a city we can find. Try searching for it."
              : "The city lookup didn't answer. Check your connection and try again."}
          </p>
          <div className="acts">
            {!notFound && (
              <button type="button" className="btn btn-secondary" onClick={() => void city.refetch()}>
                <Icon name="refresh" size={16} />
                Try again
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => openSearch()}>
              <Icon name="search" size={16} />
              Search cities
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <HeroSkeleton />;

  return (
    <div className="city-page">
      <ErrorBoundary fallback={sectionFallback('overview')}>
        <CityHero city={data} dataId={dataId} zone={zone} units={units} stay={stay} />
      </ErrorBoundary>
      <CityTabs city={data} />
      <ErrorBoundary fallback={sectionFallback('work')}>
        <WorkSection city={data} dataId={dataId} zone={zone} units={units} />
      </ErrorBoundary>
      <ErrorBoundary fallback={sectionFallback('places')}>
        <PlacesSection city={data} dataId={dataId} zone={zone} units={units} />
      </ErrorBoundary>
      <ErrorBoundary fallback={sectionFallback('stays')}>
        <StaysSection city={data} dataId={dataId} zone={zone} stay={stay} onStay={setStay} />
      </ErrorBoundary>
      <ErrorBoundary fallback={sectionFallback('weather')}>
        <WeatherSection city={data} dataId={dataId} units={units} />
      </ErrorBoundary>
      <ErrorBoundary fallback={sectionFallback('best time to go')}>
        <ClimateSection city={data} dataId={dataId} zone={zone} units={units} />
      </ErrorBoundary>
      <PhoneActionBar city={data} />
    </div>
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
    navigate(
      { pathname: `/city/${encodeURIComponent(city.id)}`, search: location.search, hash: location.hash },
      { replace: true },
    );
  }, [city, cityId, location.search, location.hash, navigate, queryClient]);
}
