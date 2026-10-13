import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api } from '../api/client';
import { cityKeys } from '../api/queries';
import type {
  City,
  Climate,
  Essentials,
  PlacesResponse,
  ScoreFactorKey,
  StaysResponse,
  Units,
  Weather,
  WorkScore,
} from '../api/types';
import { bestMonths } from '../components/ClimateCard';
import SearchBar from '../components/SearchBar';
import UnitsToggle from '../components/UnitsToggle';
import { formatRate } from '../components/WorkPanel';
import { FactorScore, ScoreChip } from '../components/WorkScore';
import { defaultUnitsFor } from '../lib/cityId';
import { formatWholeMoney, round } from '../lib/format';
import { useHomeZone } from '../lib/savedCities';
import { clockIn, formatUtcOffset, isValidTimeZone, utcOffsetMinutes, workOverlap } from '../lib/time';
import './ComparePage.css';

const MAX_CITIES = 3;
const STAYS = { occupants: 1, nights: 1 };

function parseIds(value: string | null): string[] {
  const ids = (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[\p{L}\p{N}_-]{2,120}$/u.test(id));
  return Array.from(new Set(ids)).slice(0, MAX_CITIES);
}

type Better = 'high' | 'low';

interface Row {
  label: string;
  className?: string;
  /** Number used to mark the best city in the row; null when unknown. */
  score: (index: number) => number | null;
  better?: Better;
  render: (index: number) => ReactNode;
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = parseIds(searchParams.get('cities'));
  const [units, setUnits] = useState<Units>(() => (ids[0] ? defaultUnitsFor(ids[0]) : 'metric'));
  const homeZone = useHomeZone();

  useEffect(() => {
    document.title = 'Compare cities - Remote Radar';
    return () => {
      document.title = 'Remote Radar - Find Your Perfect Remote Work Destination';
    };
  }, []);

  const cities = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.city(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.city(id, signal),
      staleTime: Infinity,
    })),
  }) as UseQueryResult<City>[];
  const weather = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.weather(id, units),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.weather(id, units, signal),
    })),
  }) as UseQueryResult<Weather>[];
  const essentials = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.essentials(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.essentials(id, signal),
    })),
  }) as UseQueryResult<Essentials>[];
  const climate = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.climate(id, units),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.climate(id, units, signal),
    })),
  }) as UseQueryResult<Climate>[];
  const places = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.places(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.places(id, undefined, signal),
    })),
  }) as UseQueryResult<PlacesResponse>[];
  const stays = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.stays(id, STAYS),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.stays(id, STAYS, signal),
    })),
  }) as UseQueryResult<StaysResponse>[];

  const scores = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.score(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.score(id, signal),
    })),
  }) as UseQueryResult<WorkScore>[];

  function setIds(next: string[]) {
    setSearchParams(
      (params) => {
        if (next.length) params.set('cities', next.join(','));
        else params.delete('cities');
        return params;
      },
      { replace: true },
    );
  }

  const zoneOf = (i: number) => cities[i]?.data?.timezone || essentials[i]?.data?.timezone || '';
  const loading = <span className="cmp-muted">…</span>;
  const unknown = <span className="cmp-muted">–</span>;
  const cell = <T,>(query: UseQueryResult<T> | undefined, show: (data: T) => ReactNode) =>
    query?.data !== undefined ? show(query.data) : query?.isError ? unknown : loading;
  const temp = units === 'imperial' ? '°F' : '°C';

  const factorScore = (i: number, key: ScoreFactorKey) =>
    scores[i]?.data?.factors.find((factor) => factor.key === key)?.score ?? null;
  const factorRow = (key: ScoreFactorKey, label: string): Row => ({
    label,
    className: 'score-sub-row',
    better: 'high',
    score: (i) => factorScore(i, key),
    render: (i) => cell(scores[i], () => <FactorScore score={factorScore(i, key)} />),
  });

  const rows: Row[] = [
    {
      label: 'Remote work score',
      className: 'score-row',
      better: 'high',
      score: (i) => scores[i]?.data?.score ?? null,
      render: (i) => cell(scores[i], (data) => <ScoreChip data={data} />),
    },
    factorRow('internet', 'Internet'),
    factorRow('places', 'Places to work'),
    factorRow('cost', 'Cost'),
    factorRow('safety', 'Safety'),
    factorRow('climate', 'Climate'),
    {
      label: 'Local time',
      score: () => null,
      render: (i) => {
        const zone = zoneOf(i);
        return isValidTimeZone(zone) ? `${clockIn(zone)} · ${formatUtcOffset(utcOffsetMinutes(zone))}` : loading;
      },
    },
    {
      label: 'Overlap with your 9 to 5',
      better: 'high',
      score: (i) => (isValidTimeZone(zoneOf(i)) ? workOverlap(homeZone, zoneOf(i)).minutes : null),
      render: (i) =>
        isValidTimeZone(zoneOf(i)) ? `${Math.round((workOverlap(homeZone, zoneOf(i)).minutes / 60) * 10) / 10} h` : loading,
    },
    {
      label: 'Internet, home',
      better: 'high',
      score: (i) => essentials[i]?.data?.internet?.fixed?.download_mbps ?? null,
      render: (i) =>
        cell(essentials[i], (e) =>
          e.internet?.fixed ? `${Math.round(e.internet.fixed.download_mbps)} Mbps down` : 'No data',
        ),
    },
    {
      label: 'Internet, mobile',
      better: 'high',
      score: (i) => essentials[i]?.data?.internet?.mobile?.download_mbps ?? null,
      render: (i) =>
        cell(essentials[i], (e) =>
          e.internet?.mobile ? `${Math.round(e.internet.mobile.download_mbps)} Mbps down` : 'No data',
        ),
    },
    {
      label: 'Weather now',
      score: () => null,
      render: (i) => cell(weather[i], (w) => `${round(w.current.temperature)}${temp}, ${w.current.description}`),
    },
    {
      label: 'Best months',
      score: () => null,
      render: (i) => cell(climate[i], (c) => bestMonths(c)),
    },
    {
      label: 'Avg. hotel night',
      better: 'low',
      score: (i) => stays[i]?.data?.average_price ?? null,
      render: (i) => cell(stays[i], (s) => formatWholeMoney(s.average_price, s.currency)),
    },
    {
      label: 'Coworking spaces',
      better: 'high',
      score: (i) => places[i]?.data?.counts.coworking ?? null,
      render: (i) => cell(places[i], (p) => String(p.counts.coworking)),
    },
    {
      label: 'Coffee shops',
      better: 'high',
      score: (i) => places[i]?.data?.counts.coffee ?? null,
      render: (i) => cell(places[i], (p) => String(p.counts.coffee)),
    },
    {
      label: 'Currency',
      score: () => null,
      render: (i) =>
        cell(essentials[i], (e) =>
          e.currency?.usd_rate && e.currency.code !== 'USD'
            ? `$1 = ${formatRate(e.currency.usd_rate, e.currency.symbol)}`
            : (e.currency?.code ?? '–'),
        ),
    },
    {
      label: 'Travel advisory',
      better: 'low',
      score: (i) => essentials[i]?.data?.advisory?.level ?? null,
      render: (i) =>
        cell(essentials[i], (e) =>
          e.advisory ? <span className={`level level-${e.advisory.level}`}>Level {e.advisory.level}</span> : 'None listed',
        ),
    },
  ];

  function bestIndex(row: Row): number | null {
    if (!row.better || ids.length < 2) return null;
    const scores = ids.map((_, i) => row.score(i));
    if (scores.some((score) => score === null)) return null;
    const values = scores as number[];
    const target = row.better === 'high' ? Math.max(...values) : Math.min(...values);
    // Only highlight a clear winner, not a tie.
    return values.filter((value) => value === target).length === 1 ? values.indexOf(target) : null;
  }

  return (
    <div className="compare-page">
      <div className="compare-head">
        <div>
          <h1>Compare cities</h1>
          <p className="compare-lede">Up to three cities side by side. Green marks the best value in a row.</p>
        </div>
        <UnitsToggle units={units} onChange={setUnits} />
      </div>

      {ids.length < MAX_CITIES && (
        <div className="compare-add">
          <SearchBar
            variant="compact"
            placeholder={ids.length ? 'Add another city' : 'Search for a city to compare'}
            onSelect={(city) => setIds(Array.from(new Set([...ids, city.id])).slice(0, MAX_CITIES))}
          />
        </div>
      )}

      {ids.length === 0 ? (
        <p className="compare-empty">
          Search for a city above, or save cities from their pages and compare them from the home page.
        </p>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Measure</span>
                </th>
                {ids.map((id, i) => {
                  const city = cities[i]?.data;
                  return (
                    <th scope="col" key={id}>
                      <Link to={`/city/${encodeURIComponent(city?.id ?? id)}`}>{city?.name ?? 'Loading…'}</Link>
                      <small>{city?.country ?? ''}</small>
                      <button
                        type="button"
                        className="compare-remove"
                        onClick={() => setIds(ids.filter((other) => other !== id))}
                        aria-label={`Remove ${city?.name ?? 'city'} from comparison`}
                      >
                        Remove
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const best = bestIndex(row);
                return (
                  <tr key={row.label} className={row.className}>
                    <th scope="row">{row.label}</th>
                    {ids.map((id, i) => (
                      <td key={id} className={best === i ? 'best' : undefined}>
                        {cities[i]?.isError ? unknown : row.render(i)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="compare-note">
        Hotel prices are for one night, one guest, a week from today. Remote work scores run from 0 to
        100; each city page shows how its score breaks down. Work overlap uses your time zone, which you can
        change on any city page.
      </p>
    </div>
  );
}
