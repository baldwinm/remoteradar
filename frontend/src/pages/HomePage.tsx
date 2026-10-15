import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { Units } from '../api/types';
import { useWeather } from '../api/queries';
import Bento from '../components/Bento';
import { compareHref } from '../components/Header';
import Icon from '../components/Icon';
import RadarPanel from '../components/RadarPanel';
import { SearchResults, openSearch, resultKeys, usePickCity, useSearchModel } from '../components/Search';
import { cssVars } from '../components/ui';
import { toast } from '../lib/chrome';
import { useNow } from '../lib/clock';
import { useIsPhone } from '../lib/layout';
import { usePopular } from '../lib/popular';
import { type CityRef, unsave, useHomeZone, useRecentCities, useSavedCities } from '../lib/savedCities';
import { skyState, sunTimes } from '../lib/sky';
import { diffShort, fmtClock, isValidTimeZone, localMinutes } from '../lib/time';
import { degrees, usePageUnits } from '../lib/units';
import { weatherIcon } from '../lib/weatherIcons';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
// Saved cities shown before "Show all", so a long list doesn't load a forecast for every city at once.
const FIRST_CARDS = 8;

export default function HomePage() {
  const phone = useIsPhone();
  const [units] = usePageUnits();
  const homeZone = useHomeZone();

  useEffect(() => {
    document.title = 'Remote Radar - Find Your Perfect Remote Work Destination';
  }, []);

  return (
    <div>
      <section className="home-hero">
        <div className="wrap">
          <span className="hh-eyebrow">
            <span className="live-dot" />
            Live data for any city in the world
          </span>
          <h1 className="hh-title">
            Scope out your next city <span className="hh-dim">before you book.</span>
          </h1>
          <p className="hh-lede">
            Weather, hotel prices, internet speed, places to work and how your hours line up, on one page for any city.
          </p>
          <div className="hh-search-wrap">{phone ? <PhoneSearch /> : <HeroSearch />}</div>
          <PopularChips />
          <YourCities units={units} homeZone={homeZone} />
          <RadarPanel units={units} homeZone={homeZone} />
        </div>
      </section>
      <Bento units={units} homeZone={homeZone} />
    </div>
  );
}

/* ---------- Search ---------- */

function PhoneSearch() {
  return (
    <button type="button" className="hh-search" onClick={() => openSearch()}>
      <Icon name="search" size={20} />
      <span>Search any city</span>
    </button>
  );
}

/** The big search box on desktop, with results dropping below it as you type. */
function HeroSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const model = useSearchModel(query, 'go');
  const pick = usePickCity();

  function go(item: Parameters<typeof pick>[0]) {
    setOpen(false);
    input.current?.blur();
    pick(item);
  }

  return (
    <>
      <label className="hh-search">
        <Icon name="search" size={22} />
        <input
          ref={input}
          type="text"
          data-hero-search=""
          value={query}
          placeholder="Search any city in the world"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label="Search for a city"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && model.items.length ? `${listId}-${active}` : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              if (open) {
                event.preventDefault();
                setOpen(false);
              }
              return;
            }
            if (!open) setOpen(true);
            resultKeys(event, model, active, setActive, go, listId);
          }}
        />
        <span className="kbds" aria-hidden="true">
          <span className="kbd">{MAC ? '⌘' : 'Ctrl'}</span>
          <span className="kbd">K</span>
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const item = model.items[active] ?? model.items[0];
            if (query.trim().length >= 2 && item) go(item);
            else {
              input.current?.focus();
              setOpen(true);
            }
          }}
        >
          Search
        </button>
      </label>
      {open && (
        <div className="hh-drop">
          <SearchResults model={model} query={query} listId={listId} active={active} onActive={setActive} onPick={go} />
          <div className="hh-drop-foot">
            Local time in each city. Press <span className="kbd">↵</span> to open the first match.
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Popular ---------- */

function PopularChips() {
  const phone = useIsPhone();
  const popular = usePopular();
  const chips = popular.cities.map((city) => (
    <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} className="chip">
      {city.name}
    </Link>
  ));
  return (
    <div className="hh-popular">
      <span className="hh-popular-label">
        {popular.scope === 'country' ? (
          <>
            Popular in <b>{popular.place}</b>
          </>
        ) : popular.scope === 'site' ? (
          'Popular on Remote Radar'
        ) : (
          'Popular'
        )}
      </span>
      {phone ? <div className="hscroll">{chips}</div> : chips}
    </div>
  );
}

/* ---------- Your cities (returning visitors) ---------- */

function YourCities({ units, homeZone }: { units: Units; homeZone: string }) {
  const phone = useIsPhone();
  const saved = useSavedCities();
  const recent = useRecentCities().filter((city) => !saved.some((item) => item.id === city.id));
  const [all, setAll] = useState(false);
  if (saved.length === 0 && recent.length === 0) return null;
  const shown = all ? saved : saved.slice(0, FIRST_CARDS);

  return (
    <section className="yc" aria-labelledby={saved.length ? 'yc-title' : undefined} aria-label={saved.length ? undefined : 'Recently viewed'}>
      {saved.length > 0 && (
        <>
          <div className="yc-head">
            <h2 id="yc-title">Your cities</h2>
            {saved.length > 1 && (
              <Link className="btn btn-secondary" to={compareHref(saved)}>
                <Icon name="compare" size={17} />
                Compare{saved.length > 3 ? ' first 3' : ''}
              </Link>
            )}
          </div>
          <div className={`yc-grid${phone ? ' hscroll' : ''}`}>
            {shown.map((city) => (
              <CityCard key={city.id} city={city} units={units} homeZone={homeZone} />
            ))}
          </div>
          {saved.length > shown.length && (
            <button type="button" className="btn btn-ghost yc-more" onClick={() => setAll(true)}>
              Show all {saved.length} cities
            </button>
          )}
        </>
      )}
      {recent.length > 0 && (
        <div className="yc-foot">
          <div className="yc-recent">
            <span>Recently viewed</span>
            {recent.map((city) => (
              <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} className="chip">
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CityCard({ city, units, homeZone }: { city: CityRef; units: Units; homeZone: string }) {
  const now = useNow();
  const weather = useWeather(city.id, units);
  const zone = city.timezone && isValidTimeZone(city.timezone) ? city.timezone : weather.data?.timezone;
  const when = new Date(now);
  const minute = zone ? localMinutes(zone, when) : null;
  const position = zone && city.lat !== undefined && city.lng !== undefined ? { lat: city.lat, lng: city.lng, timeZone: zone } : null;
  const sun = sunTimes(weather.data?.daily[0], position) ?? { rise: 420, set: 1140 };
  const sky = minute !== null ? skyState(minute, sun.rise, sun.set) : null;
  // The sun (or moon) stays in the open sky above the name, clear of the remove button.
  const f = sky?.f ?? 0.5;
  const current = weather.data?.current;

  function remove() {
    const undo = unsave(city.id);
    if (undo) toast(`Removed ${city.name}`, { undo });
  }

  return (
    <div className="ycard" data-phase={sky?.phase ?? 'day'}>
      <Link to={`/city/${encodeURIComponent(city.id)}`}>
        <div
          className="ycard-sky"
          style={cssVars({ '--sx': `${(10 + f * 68).toFixed(1)}%`, '--sy': `${(36 - Math.sin(Math.PI * f) * 22).toFixed(1)}%` })}
        >
          <b>{city.name}</b>
          <span>
            {minute !== null && fmtClock(minute)}
            <span className={minute !== null ? 'sep' : undefined}>{city.country}</span>
          </span>
        </div>
        <div className="ycard-b">
          <span>
            {current && current.temperature !== null ? (
              <>
                <Icon name={weatherIcon(current.weather_code, current.is_day)} size={16} />
                <b>{degrees(current.temperature)}</b>
                {current.description}
              </>
            ) : (
              <span className="skel ycard-skel" />
            )}
          </span>
          {zone && <span>{diffShort(zone, homeZone, when)}</span>}
        </div>
      </Link>
      <button type="button" className="ycard-x" aria-label={`Remove ${city.name} from your cities`} onClick={remove}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
