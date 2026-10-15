import { Fragment, useMemo, useRef, useState } from 'react';

import { useEssentials, useWeather } from '../../api/queries';
import type { City, Currency, Essentials, Holiday, Speed, Units } from '../../api/types';
import { toast } from '../../lib/chrome';
import { useNow } from '../../lib/clock';
import { useIsPhone } from '../../lib/layout';
import { useReveal } from '../../lib/reveal';
import { saveHomeZone, useHomeZone } from '../../lib/savedCities';
import { norm } from '../../lib/search';
import { solarTimes, sunTimes } from '../../lib/sky';
import {
  WORKDAY_END,
  WORKDAY_START,
  browserTimeZone,
  fmtClock,
  formatUtcOffset,
  hoursLabel,
  localMinutes,
  overlapSentence,
  shortHours,
  utcOffsetMinutes,
  workOverlap,
} from '../../lib/time';
import { COMMON_ZONES, zoneCity } from '../../lib/world';
import Icon from '../Icon';
import { Popover, Sheet, SheetHead } from '../overlays';
import { SecHead, cssVars } from '../ui';
import { DAYS, MONTHS } from './common';
import { CardSkeleton, SectionError } from './states';

const DAY = 24 * 60;
const pct = (minutes: number) => (minutes / DAY) * 100;

interface Props {
  city: City;
  dataId: string;
  zone: string;
  units: Units;
}

export default function WorkSection({ city, dataId, zone, units }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const homeZone = useHomeZone();
  const essentials = useEssentials(dataId);
  const [ref, pre] = useReveal<HTMLDivElement>(essentials.isSuccess);
  const overlap = workOverlap(homeZone, zone, new Date(now));
  const title = overlap.minutes
    ? `${hoursLabel(overlap.minutes)} of overlap with your workday`
    : 'No overlap with your workday';

  return (
    <section className="sec" data-sec="work" id="work" aria-labelledby="work-title">
      <div className={`wrap${pre ? ' pre' : ''}`} ref={ref}>
        <SecHead
          id="work-title"
          icon={<Icon name="clock" size={16} />}
          kicker="Work from here"
          title={title}
          lede={overlapSentence(city.name, overlap)}
          tools={<ZoneButton cityName={city.name} />}
        />
        <div className="card">
          <div className="card-b">
            <OverlapChart city={city} dataId={dataId} zone={zone} units={units} desk={!phone} />
            <p className="ovl-foot">
              Shown in {city.name} time on a weekday. Change your time zone to see the overlap from anywhere.
            </p>
          </div>
        </div>
        {essentials.isPending ? (
          <div className="trio">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        ) : essentials.isError ? (
          <div className="trio-error">
            <SectionError
              title="Internet, money and holidays didn't load"
              error={essentials.error}
              onRetry={() => void essentials.refetch()}
            />
          </div>
        ) : (
          <Essentials data={essentials.data} />
        )}
      </div>
    </section>
  );
}

/* ---------- The overlap chart ---------- */

function OverlapChart({ city, dataId, zone, units, desk }: Props & { desk: boolean }) {
  const now = useNow();
  const homeZone = useHomeZone();
  const weather = useWeather(dataId, units);
  const when = new Date(now);
  const overlap = workOverlap(homeZone, zone, when);
  const home = zoneCity(homeZone);
  const sun = sunTimes(weather.data?.daily[0], null) ?? solarTimes(city.lat, city.lng, zone, when);
  const nowMinute = localMinutes(zone, when);
  const ticks = [0, 6, 12, 18, 24];
  const edge = (index: number) => (index === 0 ? 'first' : index === ticks.length - 1 ? 'last' : undefined);
  const nowAt = pct(nowMinute);

  return (
    <div className="ovl" style={cssVars({ '--lab': desk ? '132px' : '0px' })}>
      <div className="ovl-axis" aria-hidden="true">
        {desk && <span className="ovl-axis-name">{city.name}</span>}
        {ticks.map((hour, index) => (
          <span key={hour} className={edge(index)} style={cssVars({ '--at': `${pct(hour * 60)}%` })}>
            {fmtClock(hour * 60, true)}
          </span>
        ))}
      </div>
      <div className="ovl-day" title={`Daylight in ${city.name}`}>
        <i style={cssVars({ '--a': `${pct(sun.rise)}%`, '--w': `${pct(Math.max(0, sun.set - sun.rise))}%` })} />
      </div>
      <div className="ovl-lanes">
        <div className="ovl-lane">
          <span>{city.name} 9 to 5</span>
          <div className="ovl-track">
            <i
              className="city"
              style={cssVars({ '--a': `${pct(WORKDAY_START)}%`, '--w': `${pct(WORKDAY_END - WORKDAY_START)}%` })}
            >
              9 AM to 5 PM
            </i>
          </div>
        </div>
        <div className="ovl-lane">
          <span>Your 9 to 5 in {home}</span>
          <div className="ovl-track">
            {overlap.homeSpans.map(([start, end], index) => (
              <i key={start} className="you" style={cssVars({ '--a': `${pct(start)}%`, '--w': `${pct(end - start)}%` })}>
                {index === 0 && end - start > 200 ? 'Your 9 to 5' : ''}
              </i>
            ))}
          </div>
        </div>
        {overlap.minutes > 0 && (
          <div
            className="ovl-band"
            style={cssVars({ '--a': pct(overlap.cityStart), '--w': pct(overlap.cityEnd - overlap.cityStart) })}
          >
            <b>{shortHours(overlap.minutes)}</b>
          </div>
        )}
        <div
          className={`ovl-now${nowAt > 90 ? ' at-end' : nowAt < 10 ? ' at-start' : ''}`}
          style={cssVars({ '--a': nowAt })}
        >
          <b>Now</b>
        </div>
      </div>
      <div className="ovl-axis bottom" aria-hidden="true">
        {desk && <span className="ovl-axis-name">{home}</span>}
        {ticks.map((hour, index) => (
          <span key={hour} className={edge(index)} style={cssVars({ '--at': `${pct(hour * 60)}%` })}>
            {fmtClock(hour * 60 - overlap.difference, true)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Your time zone ---------- */

function allZones(): string[] {
  try {
    return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  } catch {
    return [];
  }
}

function ZoneList({ onPick, sheet }: { onPick: (zone: string) => void; sheet: boolean }) {
  const homeZone = useHomeZone();
  const now = useNow();
  const [query, setQuery] = useState('');
  const here = browserTimeZone();
  const zones = useMemo(() => {
    const q = norm(query);
    if (!q) return Array.from(new Set([here, homeZone, ...COMMON_ZONES]));
    return allZones()
      .filter((zone) => norm(zone.replace(/_/g, ' ')).includes(q) || norm(zoneCity(zone)).includes(q))
      .slice(0, 40);
  }, [query, here, homeZone]);
  const when = new Date(now);

  return (
    <>
      <label className="zone-find">
        <Icon name="search" size={16} />
        <input
          type="text"
          value={query}
          placeholder="Find a city or time zone"
          aria-label="Find a city or time zone"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={sheet ? 'opt-list zone-opts' : 'mp-scroll'} role="group" aria-label="Time zones">
        {zones.length === 0 && <p className="mp-empty">No time zone matches “{query}”.</p>}
        {zones.map((zone) => (
          <button key={zone} type="button" aria-pressed={zone === homeZone} onClick={() => onPick(zone)}>
            <Icon name="check" size={18} className={zone === homeZone ? undefined : 'blank'} />
            <span className="zone-name">
              {zoneCity(zone)}
              {query && <span className="zone-id">{zone.replace(/_/g, ' ')}</span>}
            </span>
            {zone === here && <em className="here">This device</em>}
            <small>{formatUtcOffset(utcOffsetMinutes(zone, when))}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function ZoneButton({ cityName }: { cityName: string }) {
  const phone = useIsPhone();
  const homeZone = useHomeZone();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  function pick(zone: string) {
    saveHomeZone(zone);
    setOpen(false);
    toast(`Showing your hours from ${zoneCity(zone)}`);
  }

  return (
    <>
      <button
        type="button"
        ref={button}
        className="zone-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="globe" size={16} />
        Your time zone <span>{zoneCity(homeZone)}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {phone ? (
        <Sheet open={open} onClose={close} label="Your time zone">
          <SheetHead title="Your time zone" onClose={close} />
          <div className="sheet-body">
            <p className="sheet-note">Lines up your 9 to 5 with {cityName}&apos;s. Pick where you&apos;ll be working from.</p>
            <ZoneList onPick={pick} sheet />
          </div>
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchor={button} label="Your time zone" align="right" className="menu-pop zone-pop">
          <div className="mp-label">Your time zone</div>
          <ZoneList onPick={pick} sheet={false} />
        </Popover>
      )}
    </>
  );
}

/* ---------- Internet, money and holidays ---------- */

function SpeedRow({ label, speed }: { label: string; speed: Speed }) {
  const down = Math.round(speed.download_mbps);
  return (
    <div className="speed">
      <div className="speed-top">
        <span className="label">{label}</span>
        <span className="speed-val">
          {down}
          <small>Mbps</small>
        </span>
      </div>
      <div className="speed-bar" style={cssVars({ '--v': Math.min(100, speed.download_mbps / 2), '--m': 50 })} aria-hidden="true">
        <i />
        <em />
      </div>
      <div className="speed-sub">
        <span>
          {Math.round(speed.upload_mbps)} up, {speed.latency_ms} ms latency
        </span>
        <span>100 scores full marks</span>
      </div>
    </div>
  );
}

/** 0.92, "€" -> "€0.92"; 1520, "₫" -> "₫1,520". */
export function formatRate(rate: number, symbol: string): string {
  const digits = rate >= 100 ? 0 : 2;
  return `${symbol}${rate.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** The nearest of 1, 2, 2.5 and 5 times a power of ten. */
function niceAmount(value: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(value, 0.01)));
  const steps = [1, 2, 2.5, 5, 10];
  return (steps.reduce((best, step) => (Math.abs(step * power - value) < Math.abs(best * power - value) ? step : best), 1) * power);
}

function money(amount: number, code: string): string {
  const digits = amount >= 100 ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(digits)} ${code}`;
  }
}

function Conversions({ currency, rate }: { currency: Currency; rate: number }) {
  // Round amounts in each currency: about $5, $20 and $100 worth.
  const rows = [5, 20, 100].map((dollars) => {
    const local = niceAmount(dollars * rate);
    return { dollars, local };
  });
  return (
    <div className="conv">
      {rows.map(({ dollars, local }) => (
        <Fragment key={dollars}>
          <span>
            <b>{money(local, currency.code)}</b>
            <em>{money(local / rate, 'USD')}</em>
          </span>
          <span>
            <b>{money(dollars, 'USD')}</b>
            <em>{money(dollars * rate, currency.code)}</em>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function holidayParts(holiday: Holiday) {
  const [year = 1970, month = 1, day = 1] = holiday.date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { month: MONTHS[month - 1]?.toUpperCase() ?? '', day, weekday: DAYS[weekday] ?? '' };
}

function Essentials({ data }: { data: Essentials }) {
  const { internet, currency, holidays } = data;
  const rate = currency?.usd_rate ?? null;
  return (
    <>
      <div className="trio">
        <div className="card">
          <div className="card-h">
            <h3>Internet</h3>
            {internet && <span className="meta">Ookla, {internet.period}</span>}
          </div>
          <div className="card-b">
            {internet?.fixed && <SpeedRow label="Home broadband" speed={internet.fixed} />}
            {internet?.mobile && <SpeedRow label="Mobile" speed={internet.mobile} />}
            {!internet?.fixed && !internet?.mobile && (
              <p className="card-empty">Not enough speed tests near this city to give a fair number.</p>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Money</h3>
            {currency && (
              <span className="meta">
                {currency.name} ({currency.code})
              </span>
            )}
          </div>
          <div className="card-b">
            {currency?.code === 'USD' ? (
              <>
                <div className="rate">US dollars</div>
                <div className="label">No currency exchange needed if you earn in dollars.</div>
              </>
            ) : currency && rate ? (
              <>
                <div className="rate">$1 = {formatRate(rate, currency.symbol || `${currency.code} `)}</div>
                <div className="label">Today&apos;s rate from ExchangeRate-API</div>
                <Conversions currency={currency} rate={rate} />
              </>
            ) : (
              <p className="card-empty">
                {currency ? `Today's rate for the ${currency.name} isn't available right now.` : 'The local currency is unknown.'}
              </p>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Public holidays</h3>
            <span className="meta">Next 60 days</span>
          </div>
          <div className="card-b">
            {holidays === null ? (
              <p className="card-empty">Holiday data isn&apos;t available for this country.</p>
            ) : holidays.length === 0 ? (
              <p className="card-empty">None. Offices and coworking spaces should keep normal hours.</p>
            ) : (
              <div className="hols">
                {holidays.slice(0, 4).map((holiday) => {
                  const parts = holidayParts(holiday);
                  return (
                    <div className="hol" key={`${holiday.date}-${holiday.name}`}>
                      <span className="cal-tile" aria-hidden="true">
                        <small>{parts.month}</small>
                        <b>{parts.day}</b>
                      </span>
                      <div>
                        <div className="hol-name">{holiday.name}</div>
                        <div className="hol-sub">
                          <span className="sr-only">
                            {parts.month} {parts.day},{' '}
                          </span>
                          {parts.weekday}
                          {holiday.local_name && holiday.local_name !== holiday.name && (
                            <span className="sep">{holiday.local_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {holidays.length > 4 && <p className="hol-more">and {holidays.length - 4} more</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="pl-foot">
        Speeds from Speedtest® by Ookla® open data{internet ? `, ${internet.period}` : ''}. Rates from{' '}
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
          ExchangeRate-API
        </a>
        . Holidays from Nager.Date.{data.partial ? " Some of this couldn't be loaded right now." : ''}
      </p>
    </>
  );
}
