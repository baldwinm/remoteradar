import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { headerHeld, setHeaderAway, useHeaderAway, useHeaderSky } from '../lib/chrome';
import { useIsPhone } from '../lib/layout';
import { type CityRef, useSavedCities } from '../lib/savedCities';
import { fmtClock, isValidTimeZone, localMinutes } from '../lib/time';
import { usePageUnits } from '../lib/units';
import Icon, { Logo } from './Icon';
import { Popover, Sheet, SheetHead } from './overlays';
import { openSearch } from './Search';
import ThemeSwitch, { ThemeSeg } from './ThemeSwitch';
import UnitsToggle from './UnitsToggle';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Compare opens with the first three saved cities, or empty when fewer than two are saved. */
export function compareHref(saved: CityRef[]): string {
  if (saved.length < 2) return '/compare';
  return `/compare?cities=${saved
    .slice(0, 3)
    .map((city) => encodeURIComponent(city.id))
    .join(',')}`;
}

function localTime(city: CityRef): string | null {
  return city.timezone && isValidTimeZone(city.timezone) ? fmtClock(localMinutes(city.timezone)) : null;
}

export default function Header() {
  return useIsPhone() ? <PhoneHeader /> : <DeskHeader />;
}

/* ---------- Desktop ---------- */

function DeskHeader() {
  const onHome = useLocation().pathname === '/';
  const saved = useSavedCities();
  const savedButton = useRef<HTMLButtonElement>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const close = () => setSavedOpen(false);
  const [units, setUnits] = usePageUnits();

  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Link className="logo" to="/">
          <Logo size={26} />
          Remote Radar
        </Link>
        <nav className="hdr-nav" aria-label="Main">
          <Link to={compareHref(saved)}>
            <Icon name="compare" size={17} />
            Compare
          </Link>
          <button
            type="button"
            ref={savedButton}
            aria-expanded={savedOpen}
            aria-haspopup="dialog"
            onClick={() => setSavedOpen((open) => !open)}
          >
            <Icon name="bookmark" size={17} />
            Saved
            {saved.length > 0 && <span className="count">{saved.length}</span>}
          </button>
        </nav>
        {/* The home page has its own big search box. */}
        {onHome ? (
          <span className="hdr-spacer" />
        ) : (
          <button type="button" className="hdr-search" onClick={() => openSearch()}>
            <Icon name="search" size={17} />
            <span>Search cities</span>
            <span className="kbds" aria-hidden="true">
              <span className="kbd">{MAC ? '⌘' : 'Ctrl'}</span>
              <span className="kbd">K</span>
            </span>
          </button>
        )}
        <UnitsToggle units={units} onChange={setUnits} />
        <ThemeSwitch />
      </div>
      <Popover open={savedOpen} onClose={close} anchor={savedButton} label="Saved cities" closeOnScroll>
        <div className="mp-label">Saved cities</div>
        {saved.length === 0 && <p className="mp-empty">Nothing saved yet.</p>}
        {saved.map((city) => (
          <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} onClick={close}>
            <Icon name="pin" size={16} />
            {city.name}
            {localTime(city) && <small>{localTime(city)}</small>}
          </Link>
        ))}
        <div className="mp-sep" />
        <Link to={compareHref(saved)} onClick={close}>
          <Icon name="compare" size={16} />
          Compare cities
        </Link>
      </Popover>
    </header>
  );
}

/* ---------- Phones ---------- */

/** Tucks the header away while scrolling down a page and brings it back on the way up. */
function useScrollAway() {
  useEffect(() => {
    let lastY = window.scrollY;
    let away = false;
    let frame = 0;
    function update() {
      frame = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (y < 90) away = false;
      else if (headerHeld()) away = true;
      else if (dy > 6) away = true;
      else if (dy < -6) away = false;
      setHeaderAway(away);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      setHeaderAway(false);
    };
  }, []);
}

function PhoneHeader() {
  const away = useHeaderAway();
  const sky = useHeaderSky();
  const [sheet, setSheet] = useState<'menu' | 'saved' | null>(null);
  const close = () => setSheet(null);
  useScrollAway();

  const classes = ['hdr'];
  if (away) classes.push('is-away');
  if (sky?.onSky) classes.push('on-sky');
  if (sky?.onSky && sky.veiled) classes.push('is-veiled');

  return (
    <header className={classes.join(' ')} data-phase={sky?.phase}>
      <div className="hdr-in">
        <Link className="logo" to="/">
          <Logo size={24} />
          Remote Radar
        </Link>
        <div className="hdr-actions">
          <button type="button" className="icon-btn" aria-label="Search cities" onClick={() => openSearch()}>
            <Icon name="search" size={22} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Menu"
            aria-haspopup="dialog"
            aria-expanded={sheet === 'menu'}
            onClick={() => setSheet('menu')}
          >
            <Icon name="menu" size={22} />
          </button>
        </div>
      </div>
      <MenuSheet open={sheet === 'menu'} onClose={close} onSaved={() => setSheet('saved')} />
      <SavedSheet open={sheet === 'saved'} onClose={close} />
    </header>
  );
}

function MenuSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const saved = useSavedCities();
  const [units, setUnits] = usePageUnits();
  return (
    <Sheet open={open} onClose={onClose} label="Menu">
      <SheetHead title="Menu" onClose={onClose} />
      <div className="sheet-body">
        <nav className="menu-list" aria-label="Main">
          <Link to="/" onClick={onClose}>
            <Icon name="home" size={20} />
            Home
            <Icon name="chevron-right" size={18} />
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              openSearch();
            }}
          >
            <Icon name="search" size={20} />
            Search cities
            <Icon name="chevron-right" size={18} />
          </button>
          <Link to={compareHref(saved)} onClick={onClose}>
            <Icon name="compare" size={20} />
            Compare cities
            <Icon name="chevron-right" size={18} />
          </Link>
          <button type="button" onClick={onSaved}>
            <Icon name="bookmark" size={20} />
            Saved cities
            {saved.length > 0 && <span className="count">{saved.length}</span>}
            <Icon name="chevron-right" size={18} />
          </button>
          <Link to="/privacy" onClick={onClose}>
            <Icon name="lock" size={20} />
            Privacy policy
            <Icon name="chevron-right" size={18} />
          </Link>
        </nav>
        <div>
          <span className="field-label">Appearance</span>
          <ThemeSeg />
        </div>
        <div>
          <span className="field-label">Temperature</span>
          <UnitsToggle units={units} onChange={setUnits} />
        </div>
      </div>
    </Sheet>
  );
}

function SavedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = useSavedCities();
  return (
    <Sheet open={open} onClose={onClose} label="Saved cities">
      <SheetHead title="Saved cities" onClose={onClose} />
      <div className="sheet-body">
        {saved.length > 0 ? (
          <nav className="menu-list" aria-label="Saved cities">
            {saved.map((city) => (
              <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`} onClick={onClose}>
                <Icon name="pin" size={20} />
                <span className="ml-main">
                  {city.name}
                  <small>{city.country}</small>
                </span>
                {localTime(city) && <span className="count">{localTime(city)}</span>}
                <Icon name="chevron-right" size={18} />
              </Link>
            ))}
          </nav>
        ) : (
          <p className="sheet-note">Nothing saved yet. Tap Save on any city page.</p>
        )}
      </div>
    </Sheet>
  );
}
