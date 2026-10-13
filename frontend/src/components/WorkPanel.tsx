import { useMemo } from 'react';

import { useEssentials } from '../api/queries';
import type { City, Essentials, Speed } from '../api/types';
import { shortDate } from '../lib/format';
import { saveHomeZone, useHomeZone } from '../lib/savedCities';
import { WORKDAY_END, WORKDAY_START, browserTimeZone, minuteLabel, workOverlap } from '../lib/time';
import './WorkPanel.css';

const DAY = 24 * 60;

interface Props {
  cityId: string;
  city: City;
}

export default function WorkPanel({ cityId, city }: Props) {
  const essentials = useEssentials(cityId);
  const cityZone = city.timezone || essentials.data?.timezone || '';

  return (
    <section className="card work" id="work" aria-labelledby="work-title">
      <div className="card-head">
        <h2 id="work-title">Work from here</h2>
        <HomeZonePicker />
      </div>

      {cityZone ? (
        <OverlapChart cityName={city.name} cityZone={cityZone} />
      ) : (
        <p className="widget-empty">Local time isn't available for this city.</p>
      )}

      {essentials.isPending ? (
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading internet, money and holidays…</p>
        </div>
      ) : essentials.isError ? (
        <div className="widget-error">
          Internet speed, exchange rate and holidays are unavailable right now. {essentials.error.message}
        </div>
      ) : (
        <EssentialFacts essentials={essentials.data} />
      )}

      <div className="card-foot">
        <span>
          Speeds: Speedtest® by Ookla® open data
          {essentials.data?.internet ? `, ${essentials.data.internet.period}` : ''}. Rates:{' '}
          <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
            ExchangeRate-API
          </a>
          . Holidays: Nager.Date.
        </span>
      </div>
    </section>
  );
}

function zoneLabel(zone: string) {
  return zone.replace(/_/g, ' ');
}

function HomeZonePicker() {
  const homeZone = useHomeZone();
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return Array.from(new Set([browserTimeZone(), homeZone, ...all])).sort();
  }, [homeZone]);

  return (
    <label className="work-zone">
      Your time zone
      <select
        id="home-time-zone"
        className="select"
        value={homeZone}
        onChange={(event) => saveHomeZone(event.target.value)}
      >
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zoneLabel(zone)}
          </option>
        ))}
      </select>
    </label>
  );
}

function hoursLabel(minutes: number) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** One-line summary of how a 9-to-5 at home lines up with one in the city. */
export function overlapSummary(cityName: string, homeZone: string, cityZone: string): string {
  const overlap = workOverlap(homeZone, cityZone);
  if (overlap.difference === 0) return `Same working hours as you: ${cityName} is on your time.`;
  if (overlap.minutes === 0) {
    return `No overlap: 9 AM in ${cityName} is ${minuteLabel(WORKDAY_START - overlap.difference)} for you.`;
  }
  return `${hoursLabel(overlap.minutes)} overlap: ${minuteLabel(overlap.cityStart)} to ${minuteLabel(
    overlap.cityEnd,
  )} in ${cityName} is ${minuteLabel(overlap.homeStart)} to ${minuteLabel(overlap.homeEnd)} for you.`;
}

function OverlapChart({ cityName, cityZone }: { cityName: string; cityZone: string }) {
  const homeZone = useHomeZone();
  const overlap = workOverlap(homeZone, cityZone);
  const pct = (minutes: number) => `${(minutes / DAY) * 100}%`;
  const span = (start: number, end: number, className: string) => (
    <span key={`${className}-${start}`} className={className} style={{ left: pct(start), width: pct(end - start) }} />
  );

  return (
    <div className="overlap">
      <p className="overlap-caption">Shown in {cityName} local time</p>
      <div className="track-row">
        <span>Your 9 to 5</span>
        <div className="track">{overlap.homeSpans.map(([start, end]) => span(start, end, 'track-you'))}</div>
      </div>
      <div className="track-row">
        <span>{cityName} 9 to 5</span>
        <div className="track">{span(WORKDAY_START, WORKDAY_END, 'track-city')}</div>
      </div>
      <div className="track-row">
        <span>Overlap</span>
        <div className="track">{overlap.minutes > 0 && span(overlap.cityStart, overlap.cityEnd, 'track-both')}</div>
      </div>
      <div className="track-row track-ticks" aria-hidden="true">
        <span />
        <div>
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>
      </div>
      <p className={overlap.minutes > 0 || overlap.difference === 0 ? 'overlap-callout' : 'overlap-callout none'}>
        {overlapSummary(cityName, homeZone, cityZone)}
      </p>
    </div>
  );
}

function speedValue(speed: Speed | null) {
  return speed ? `${Math.round(speed.download_mbps)} / ${Math.round(speed.upload_mbps)} Mbps` : 'No data';
}

function EssentialFacts({ essentials }: { essentials: Essentials }) {
  const { internet, currency, holidays } = essentials;
  return (
    <>
      <dl className="facts">
        <div className="fact">
          <dt>Internet, home</dt>
          <dd className="fact-value">{speedValue(internet?.fixed ?? null)}</dd>
          <dd className="fact-hint">
            {internet?.fixed ? `down / up, ${internet.fixed.latency_ms} ms latency` : 'Not enough speed tests nearby'}
          </dd>
        </div>
        <div className="fact">
          <dt>Internet, mobile</dt>
          <dd className="fact-value">{speedValue(internet?.mobile ?? null)}</dd>
          <dd className="fact-hint">
            {internet?.mobile ? `down / up, ${internet.mobile.latency_ms} ms latency` : 'Not enough speed tests nearby'}
          </dd>
        </div>
        <div className="fact">
          <dt>Money</dt>
          <dd className="fact-value">
            {currency?.usd_rate ? `$1 = ${formatRate(currency.usd_rate, currency.symbol)}` : (currency?.code ?? '–')}
          </dd>
          <dd className="fact-hint">{currency ? `${currency.name} (${currency.code})` : 'Currency unknown'}</dd>
        </div>
      </dl>

      <div className="holidays">
        <h3>Public holidays, next 60 days</h3>
        {holidays === null ? (
          <p className="fact-hint">Holiday data isn't available for this country.</p>
        ) : holidays.length === 0 ? (
          <p className="fact-hint">None. Offices and coworking spaces should keep normal hours.</p>
        ) : (
          <ul>
            {holidays.map((holiday) => (
              <li key={`${holiday.date}-${holiday.name}`}>
                <span className="holiday-date">{shortDate(holiday.date)}</span>
                <span>
                  {holiday.name}
                  {holiday.local_name && holiday.local_name !== holiday.name && (
                    <span className="fact-hint"> · {holiday.local_name}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {essentials.partial && <p className="work-note">Some of this couldn't be loaded right now.</p>}
    </>
  );
}

/** 0.92, "€" -> "€0.92"; 33.1, "฿" -> "฿33.10"; 1520, "₫" -> "₫1,520". */
export function formatRate(rate: number, symbol: string): string {
  const digits = rate >= 100 ? 0 : 2;
  return `${symbol}${rate.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
