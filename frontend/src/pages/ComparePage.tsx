import { type UseQueryResult, keepPreviousData, useQueries, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

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
import Icon, { type IconName } from '../components/Icon';
import { openSearch } from '../components/Search';
import { formatRate } from '../components/city/WorkSection';
import { MONTHS, bestRuns, usd } from '../components/city/common';
import { Bar, Ring, cssVars } from '../components/ui';
import { sharePage, toast } from '../lib/chrome';
import { useNow } from '../lib/clock';
import { useIsPhone, useOnScroll } from '../lib/layout';
import { useReveal } from '../lib/reveal';
import { useHomeZone, useSavedCities } from '../lib/savedCities';
import { tierOf } from '../lib/score';
import { countryFromId } from '../lib/search';
import { skyState, sunTimes } from '../lib/sky';
import {
  fmtClock,
  formatUtcOffset,
  isValidTimeZone,
  localMinutes,
  shortHours,
  utcOffsetMinutes,
  workOverlap,
} from '../lib/time';
import { degrees, usePageUnits } from '../lib/units';
import { weatherIcon } from '../lib/weatherIcons';
import { zoneCity } from '../lib/world';

const MAX_CITIES = 3;
const STAYS = { occupants: 1, nights: 1 };
const TITLE = 'Compare cities - Remote Radar';
const DEFAULT_TITLE = 'Remote Radar - Find Your Perfect Remote Work Destination';

/** Each factor's share of the score when a city has data for all four (the API's weights). */
const FACTORS: readonly { key: ScoreFactorKey; label: string; weight: number }[] = [
  { key: 'internet', label: 'Internet', weight: 29 },
  { key: 'places', label: 'Places to work', weight: 29 },
  { key: 'cost', label: 'Cost', weight: 24 },
  { key: 'climate', label: 'Climate', weight: 18 },
];

function parseIds(value: string | null): string[] {
  const ids = (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[\p{L}\p{N}_-]{2,120}$/u.test(id));
  return Array.from(new Set(ids)).slice(0, MAX_CITIES);
}

// Commas stay as they are, so a shared link reads ?cities=lisbon--lisbon--pt,porto--porto--pt.
const citiesParam = (ids: string[]) => ids.map(encodeURIComponent).join(',');
const compareUrl = (ids: string[]) => (ids.length ? `/compare?cities=${citiesParam(ids)}` : '/compare');

/* ---------- Data ---------- */

interface Column {
  /** The ID in the link. */
  id: string;
  city: UseQueryResult<City>;
  weather: UseQueryResult<Weather>;
  essentials: UseQueryResult<Essentials>;
  climate: UseQueryResult<Climate>;
  places: UseQueryResult<PlacesResponse>;
  stays: UseQueryResult<StaysResponse>;
  score: UseQueryResult<WorkScore>;
  /** The city's time zone, once known; empty until then. */
  zone: string;
}

/** One query per city, shared with the city pages' cache. Waits while a city's ID is still unknown. */
function usePerCity<T>(
  dataIds: string[],
  key: (id: string) => readonly unknown[],
  load: (id: string, signal: AbortSignal) => Promise<T>,
  keepWhileLoading = false,
): UseQueryResult<T>[] {
  return useQueries({
    queries: dataIds.map((dataId, index) => ({
      queryKey: dataId ? key(dataId) : ['compare', 'waiting', index],
      queryFn: ({ signal }: { signal: AbortSignal }) => load(dataId, signal),
      enabled: dataId !== '',
      // Switching °C and °F keeps the old numbers up until the new ones land.
      placeholderData: keepWhileLoading ? keepPreviousData : undefined,
    })),
  }) as UseQueryResult<T>[];
}

function useColumns(ids: string[], units: Units): Column[] {
  const cities = useQueries({
    queries: ids.map((id) => ({
      queryKey: cityKeys.city(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.city(id, signal),
      staleTime: Infinity,
    })),
  }) as UseQueryResult<City>[];
  // As on the city page: a full ID (city--region--country) loads everything at once; an older or
  // shorter one waits for the city, so nothing loads twice.
  const dataIds = ids.map((id, index) => cities[index]?.data?.id ?? (id.split('--').length >= 3 ? id : ''));
  const weather = usePerCity(dataIds, (id) => cityKeys.weather(id, units), (id, signal) => api.weather(id, units, signal), true);
  const essentials = usePerCity(dataIds, cityKeys.essentials, (id, signal) => api.essentials(id, signal));
  const climate = usePerCity(dataIds, (id) => cityKeys.climate(id, units), (id, signal) => api.climate(id, units, signal), true);
  const places = usePerCity(dataIds, (id) => cityKeys.places(id), (id, signal) => api.places(id, undefined, signal));
  const stays = usePerCity(dataIds, (id) => cityKeys.stays(id, STAYS), (id, signal) => api.stays(id, STAYS, signal));
  const score = usePerCity(dataIds, cityKeys.score, (id, signal) => api.score(id, signal));

  return ids.map((id, index) => {
    const found = cities[index]?.data?.timezone || essentials[index]?.data?.timezone || '';
    return {
      id,
      city: cities[index]!,
      weather: weather[index]!,
      essentials: essentials[index]!,
      climate: climate[index]!,
      places: places[index]!,
      stays: stays[index]!,
      score: score[index]!,
      zone: isValidTimeZone(found) ? found : '',
    };
  });
}

/* ---------- Cells ---------- */

const Waiting = () => (
  <span className="skel cmp-skel">
    <span className="sr-only">Loading</span>
  </span>
);

const Muted = ({ children }: { children: ReactNode }) => <span className="muted">{children}</span>;

/** The cell for one query: its value once loaded, a placeholder before, a note if it failed. */
function show<T>(query: UseQueryResult<T>, render: (data: T) => ReactNode): ReactNode {
  if (query.data !== undefined) return render(query.data);
  if (query.isError) return <Muted>Not available</Muted>;
  return <Waiting />;
}

/** "May, Jun, Sep, Oct", or "Nov to Apr" for a longer run. */
function bestMonthsLabel(climate: Climate): string {
  const runs = bestRuns(climate.months);
  if (runs.length === 0) return 'No standout months';
  if (runs.length === 1 && runs[0]?.[0] === 1 && runs[0][1] === 12) return 'All year';
  return runs
    .map(([start, end]) => {
      const length = ((end - start + 12) % 12) + 1;
      if (length >= 3) return `${MONTHS[start - 1]} to ${MONTHS[end - 1]}`;
      return length === 2 ? `${MONTHS[start - 1]}, ${MONTHS[end - 1]}` : MONTHS[start - 1];
    })
    .join(', ');
}

type Better = 'high' | 'low';

interface Row {
  label: string;
  /** A line under the label, on desktop. */
  sub?: string;
  /** Which way is better, for marking the best city in the row. */
  better?: Better;
  /** The score row, which phones leave out: their pinned city cards already show each score. */
  isScore?: boolean;
  /** The number compared for the best mark; null while unknown. */
  value?: (column: Column) => number | null;
  render: (column: Column) => ReactNode;
}

interface Group {
  title: string;
  icon: IconName;
  rows: Row[];
}

function factorOf(column: Column, key: ScoreFactorKey): number | null {
  return column.score.data?.factors.find((factor) => factor.key === key)?.score ?? null;
}

function groups(homeZone: string, when: Date): Group[] {
  const overlap = (column: Column) => (column.zone ? workOverlap(homeZone, column.zone, when).minutes : null);
  const speed = (column: Column, kind: 'fixed' | 'mobile') => column.essentials.data?.internet?.[kind]?.download_mbps ?? null;
  const speedCell = (kind: 'fixed' | 'mobile') => (column: Column) =>
    show(column.essentials, (data) => {
      const mbps = data.internet?.[kind]?.download_mbps;
      return mbps === undefined ? <Muted>No data</Muted> : `${Math.round(mbps)} Mbps`;
    });
  const zoneCell = (column: Column, render: (zone: string) => ReactNode) =>
    column.zone ? render(column.zone) : column.city.isPending || column.essentials.isPending ? <Waiting /> : <Muted>Unknown</Muted>;

  return [
    {
      title: 'Remote work score',
      icon: 'gauge',
      rows: [
        {
          label: 'Score',
          sub: '0 to 100',
          better: 'high',
          isScore: true,
          value: (column) => column.score.data?.score ?? null,
          render: (column) =>
            show(column.score, (data) => {
              if (data.score === null) return <Muted>Not enough data</Muted>;
              const tier = tierOf(data.score);
              return (
                <span className={`cmp-tier tier-${tier.key}`}>
                  <Ring score={data.score} size={36} stroke={4} fontSize={13} />
                  <span>{tier.label}</span>
                </span>
              );
            }),
        },
        ...FACTORS.map(
          (factor): Row => ({
            label: factor.label,
            sub: `${factor.weight}% of the score`,
            better: 'high',
            value: (column) => factorOf(column, factor.key),
            render: (column) =>
              show(column.score, () => {
                const value = factorOf(column, factor.key);
                if (value === null) return <Muted>No data</Muted>;
                return (
                  <span className={`cmp-factor tier-${tierOf(value).key}`}>
                    <span className="fnum">{value}</span>
                    <Bar value={value} />
                  </span>
                );
              }),
          }),
        ),
      ],
    },
    {
      title: 'Time and internet',
      icon: 'clock',
      rows: [
        {
          label: 'Local time',
          render: (column) =>
            zoneCell(column, (zone) => (
              <>
                {fmtClock(localMinutes(zone, when))}
                <span className="muted">{formatUtcOffset(utcOffsetMinutes(zone, when))}</span>
              </>
            )),
        },
        {
          label: 'Overlap with your 9 to 5',
          sub: `From ${zoneCity(homeZone)}`,
          better: 'high',
          value: overlap,
          render: (column) => zoneCell(column, (zone) => shortHours(workOverlap(homeZone, zone, when).minutes)),
        },
        {
          label: 'Internet, home',
          sub: 'Average download',
          better: 'high',
          value: (column) => speed(column, 'fixed'),
          render: speedCell('fixed'),
        },
        {
          label: 'Internet, mobile',
          sub: 'Average download',
          better: 'high',
          value: (column) => speed(column, 'mobile'),
          render: speedCell('mobile'),
        },
      ],
    },
    {
      title: 'Weather',
      icon: 'cloud-sun',
      rows: [
        {
          label: 'Weather now',
          render: (column) =>
            show(column.weather, ({ current }) => (
              <>
                <Icon name={weatherIcon(current.weather_code, current.is_day)} size={18} />
                {degrees(current.temperature)}
                <span className="muted">{current.description}</span>
              </>
            )),
        },
        {
          label: 'Best months',
          sub: 'Mild with the least rain',
          render: (column) => show(column.climate, (data) => (data.months.length ? bestMonthsLabel(data) : <Muted>No data</Muted>)),
        },
      ],
    },
    {
      title: 'Cost and money',
      icon: 'cash',
      rows: [
        {
          label: 'Average hotel night',
          sub: '1 guest, a week from today',
          better: 'low',
          value: (column) => column.stays.data?.average_price ?? null,
          render: (column) =>
            show(column.stays, (data) => (data.average_price === null ? <Muted>No hotels found</Muted> : usd(data.average_price))),
        },
        {
          label: 'Exchange rate',
          render: (column) =>
            show(column.essentials, ({ currency }) => {
              if (!currency) return <Muted>Unknown</Muted>;
              if (currency.code === 'USD') return 'US dollar';
              if (!currency.usd_rate) return currency.code;
              return `$1 = ${formatRate(currency.usd_rate, currency.symbol || `${currency.code} `)}`;
            }),
        },
      ],
    },
    {
      title: 'Places',
      icon: 'pin',
      rows: [
        {
          label: 'Coworking spaces',
          better: 'high',
          value: (column) => column.places.data?.counts.coworking ?? null,
          render: (column) => show(column.places, (data) => String(data.counts.coworking)),
        },
        {
          label: 'Coffee shops',
          better: 'high',
          value: (column) => column.places.data?.counts.coffee ?? null,
          render: (column) => show(column.places, (data) => String(data.counts.coffee)),
        },
      ],
    },
  ];
}

/** The column with a clear best value, once every city has one. Ties mark nothing. */
function bestIndex(row: Row, columns: Column[]): number {
  if (!row.better || !row.value || columns.length < 2) return -1;
  const values = columns.map(row.value);
  if (values.some((value) => value === null)) return -1;
  const numbers = values as number[];
  const target = row.better === 'high' ? Math.max(...numbers) : Math.min(...numbers);
  return numbers.filter((value) => value === target).length === 1 ? numbers.indexOf(target) : -1;
}

/* ---------- City cards ---------- */

function CityHead({ column, when, onRemove }: { column: Column; when: Date; onRemove: () => void }) {
  const city = column.city.data;
  const { zone } = column;
  const minute = zone ? localMinutes(zone, when) : 720;
  const sun = city && zone ? sunTimes(column.weather.data?.daily[0], { lat: city.lat, lng: city.lng, timeZone: zone }) : null;
  const sky = skyState(minute, sun?.rise ?? 420, sun?.set ?? 1140);
  const score = column.score.data?.score ?? null;
  const tier = tierOf(score);
  const missing = column.city.isError;
  const name = city?.name ?? '';
  const country = city?.country ?? countryFromId(column.id);

  let tierText: ReactNode = tier.label;
  if (missing || column.score.isError) tierText = 'Not available';
  else if (column.score.isPending) tierText = <span className="skel cmp-tier-skel" />;
  else if (score === null) tierText = 'Not enough data';
  const spoken =
    score !== null
      ? `Remote work score ${score} out of 100, ${tier.label}`
      : column.score.isPending && !missing
        ? 'Remote work score loading'
        : 'Remote work score not available';

  return (
    <div className="cmp-city" data-phase={zone ? sky.phase : 'day'}>
      <div
        className="cmp-sky"
        style={cssVars({
          '--sx': `${(14 + sky.f * 72).toFixed(0)}%`,
          '--sy': `${(84 - Math.sin(Math.PI * sky.f) * 56).toFixed(0)}%`,
        })}
      >
        {city ? (
          <Link to={`/city/${encodeURIComponent(city.id)}`}>{city.name}</Link>
        ) : missing ? (
          <b>City not found</b>
        ) : (
          <span className="skel cmp-name-skel" />
        )}
        <span>
          {zone ? (
            <>
              {fmtClock(minute)}
              {country && <span className="sep">{country}</span>}
            </>
          ) : (
            country
          )}
        </span>
      </div>
      <button type="button" className="cmp-x" aria-label={`Remove ${name || 'this city'}`} onClick={onRemove}>
        <Icon name="x" size={14} />
      </button>
      <div className={`cmp-score tier-${tier.key}`}>
        <Ring score={score} size={44} stroke={5} fontSize={15} />
        <div aria-hidden="true">
          <strong className="tier-text">{tierText}</strong>
          <small>Remote work score</small>
        </div>
        <span className="sr-only">{spoken}</span>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function ComparePage() {
  const phone = useIsPhone();
  const [searchParams] = useSearchParams();
  const ids = parseIds(searchParams.get('cities'));
  const idsKey = ids.join(',');
  const [units] = usePageUnits();
  const homeZone = useHomeZone();
  const saved = useSavedCities();
  const now = useNow();
  const when = new Date(now);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const columns = useColumns(ids, units);
  const headingId = useId();
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [revealRef, pre] = useReveal<HTMLDivElement>(columns.every((column) => !column.score.isPending));

  useEffect(() => {
    document.title = TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, []);

  const setIds = useCallback(
    (next: string[]) => {
      const unique = Array.from(new Set(next)).slice(0, MAX_CITIES);
      // Keeps anything else in the link, such as ?units=.
      const params = new URLSearchParams(window.location.search);
      params.delete('cities');
      const search = [unique.length ? `cities=${citiesParam(unique)}` : '', params.toString()].filter(Boolean).join('&');
      navigate({ pathname: '/compare', search: search ? `?${search}` : '' }, { replace: true });
    },
    [navigate],
  );

  // Older links use IDs like "paris_fr"; once each city is found, the link switches to its current ID.
  const resolvedKey = Array.from(new Set(columns.map((column) => column.city.data?.id ?? column.id))).join(',');
  useEffect(() => {
    if (!idsKey || resolvedKey === idsKey) return;
    for (const id of idsKey.split(',')) {
      const city = queryClient.getQueryData<City>(cityKeys.city(id));
      if (city && city.id !== id) queryClient.setQueryData(cityKeys.city(city.id), city);
    }
    setIds(resolvedKey.split(','));
  }, [idsKey, resolvedKey, queryClient, setIds]);

  // Once the city cards pin to the top, they shrink to leave more room for the rows.
  useOnScroll(() => {
    const node = bar.current;
    if (!node) return;
    const top = parseFloat(getComputedStyle(node).top) || 0;
    setStuck(window.scrollY > 120 && node.getBoundingClientRect().top <= top + 1);
  });

  function add() {
    openSearch({ mode: 'compare', exclude: ids, onPick: (item) => setIds([...ids, item.id]) });
  }

  function remove(index: number) {
    const before = ids;
    const name = columns[index]?.city.data?.name;
    setIds(ids.filter((_, other) => other !== index));
    toast(name ? `Removed ${name}` : 'Removed the city', {
      // Undo after leaving the page brings the comparison back, rather than rewriting another page.
      undo: () => navigate(compareUrl(before), { replace: window.location.pathname === '/compare' }),
    });
  }

  const slots = MAX_CITIES - ids.length;
  const allGroups = groups(homeZone, when);
  const addButton = (
    <button type="button" className="btn btn-primary" onClick={add}>
      <Icon name="plus" size={16} />
      Add a city
    </button>
  );

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Compare cities</h1>
          <p>Up to three cities side by side. Green marks the best value in each row.</p>
        </div>
        {ids.length > 0 && (
          <div className="page-tools">
            <button type="button" className="btn btn-secondary" onClick={() => void sharePage(TITLE, phone)}>
              <Icon name="share" size={17} />
              Share
            </button>
          </div>
        )}
      </div>

      {ids.length === 0 ? (
        <div className="card cmp-empty">
          <div className="state-card center">
            <span className="state-ic">
              <Icon name="compare" size={22} />
            </span>
            <h2>Pick up to three cities</h2>
            <p>See remote work scores, internet speeds, weather, hotel prices and places to work side by side.</p>
            <div className="acts">
              {/* Phones stack the buttons, with the main one first. */}
              {phone && addButton}
              {saved.length >= 2 && (
                <button type="button" className="btn btn-secondary" onClick={() => setIds(saved.map((city) => city.id))}>
                  <Icon name="bookmark" size={16} />
                  Compare saved cities
                </button>
              )}
              {!phone && addButton}
            </div>
          </div>
        </div>
      ) : (
        <div className={pre ? 'cmp pre' : 'cmp'} ref={revealRef}>
          <div className={`cmp-cities${stuck ? ' is-stuck' : ''}`} ref={bar}>
            <div className="cmp-key">
              <span>
                <span className="best-swatch" />
                Best in the row
              </span>
              <span>
                {ids.length} of {MAX_CITIES} cities
              </span>
            </div>
            {columns.map((column, index) => (
              <CityHead key={column.id} column={column} when={when} onRemove={() => remove(index)} />
            ))}
            {slots > 0 && (
              <button type="button" className="cmp-add" onClick={add}>
                <span className="tile">
                  <Icon name="plus" size={20} />
                </span>
                Add a city
              </button>
            )}
            {Array.from({ length: Math.max(0, slots - 1) }, (_, index) => (
              <div key={index} aria-hidden="true" />
            ))}
          </div>

          {allGroups.map((group, groupIndex) => {
            const titleId = `${headingId}-${groupIndex}`;
            return (
              <div className="cmp-group" key={group.title}>
                <h3 id={titleId}>
                  <Icon name={group.icon} size={17} />
                  {group.title}
                </h3>
                <div className="cmp-rows" role="table" aria-labelledby={titleId}>
                  <div className="sr-only" role="row">
                    <span role="columnheader">Measure</span>
                    {columns.map((column) => (
                      <span role="columnheader" key={column.id}>
                        {column.city.data?.name ?? 'City'}
                      </span>
                    ))}
                  </div>
                  {group.rows.map((row) => {
                    const best = bestIndex(row, columns);
                    return (
                      <div className={`cmp-row${row.isScore ? ' is-score' : ''}`} role="row" key={row.label}>
                        <div className="cmp-label" role="rowheader">
                          {row.label}
                          {row.sub && !phone && <small>{row.sub}</small>}
                        </div>
                        {columns.map((column, index) => (
                          <div className={`cmp-cell${best === index ? ' best' : ''}`} role="cell" key={column.id}>
                            {column.city.isError ? <Muted>–</Muted> : row.render(column)}
                            {best === index && <Icon name="check" size={16} className="best-mark" label="Best" />}
                          </div>
                        ))}
                        {Array.from({ length: slots }, (_, index) => (
                          <div className="cmp-cell" aria-hidden="true" key={`pad-${index}`} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ids.length > 0 && (
        <p className="cmp-foot">
          Hotel prices are for one night, one guest, a week from today. Work overlap uses your time zone, which you can
          change on any city page. Scores run from 0 to 100; each city page shows how its score adds up.
        </p>
      )}
    </div>
  );
}
