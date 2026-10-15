import { type MouseEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { StayOptions } from '../../api/client';
import { useEssentials, usePlaces, useStays, useWeather, useWorkScore } from '../../api/queries';
import type { City, Units, WorkScore } from '../../api/types';
import { seeded } from '../../lib/charts';
import { setHeaderSky, sharePage, toast } from '../../lib/chrome';
import { useNow } from '../../lib/clock';
import { formatCoords } from '../../lib/format';
import { useIsPhone } from '../../lib/layout';
import { useReveal } from '../../lib/reveal';
import { toRef, toggleSaved, unsave, useHomeZone, useSavedCities } from '../../lib/savedCities';
import { tierOf, verdict } from '../../lib/score';
import { type SkyState, skyState, sunTimes } from '../../lib/sky';
import {
  diffLabel,
  diffShort,
  fmtClock,
  formatUtcOffset,
  localMinutes,
  shortHours,
  utcOffsetMinutes,
  workOverlap,
  zoneDate,
} from '../../lib/time';
import { degrees } from '../../lib/units';
import { weatherIcon } from '../../lib/weatherIcons';
import { zoneCity } from '../../lib/world';
import Icon, { type IconName } from '../Icon';
import UnitsToggle from '../UnitsToggle';
import { Bar, Ring, cssVars } from '../ui';
import { DAYS_LONG, currencyLabel, goToSection, guestsLabel, inLocal, usd } from './common';

interface HeroProps {
  city: City;
  /** The ID the sections load with; empty until it's known. */
  dataId: string;
  zone: string;
  units: Units;
  onUnits: (units: Units) => void;
  stay: StayOptions;
}

/** Where the city sits: "Lisbon, Portugal", leaving out a region that just repeats the city's name. */
function placeLine(city: City): string {
  const region = city.state && city.state !== city.name ? city.state : '';
  return [region, city.country].filter(Boolean).join(', ');
}

/** Compare this city with up to two saved ones. */
export function compareWith(city: City, saved: { id: string }[]): string {
  const others = saved.filter((item) => item.id !== city.id).slice(0, 2);
  return `/compare?cities=${[city.id, ...others.map((item) => item.id)].map(encodeURIComponent).join(',')}`;
}

export function SaveButton({ city, className, size }: { city: City; className: string; size: number }) {
  const saved = useSavedCities();
  const on = saved.some((item) => item.id === city.id);

  function toggle() {
    if (on) {
      const undo = unsave(city.id);
      if (undo) toast(`Removed ${city.name} from your cities`, { undo });
      return;
    }
    toggleSaved(toRef(city));
    toast(`Saved ${city.name}`);
  }

  return (
    <button type="button" className={`btn ${className}`} aria-pressed={on} onClick={toggle}>
      <Icon name="bookmark" size={size} filled={on} />
      {on ? 'Saved' : 'Save'}
    </button>
  );
}

export default function CityHero(props: HeroProps) {
  const phone = useIsPhone();
  const { city, dataId, zone, units } = props;
  const now = useNow();
  const when = new Date(now);
  const weather = useWeather(dataId, units);
  const score = useWorkScore(dataId);
  const minute = localMinutes(zone, when);
  const sun = sunTimes(weather.data?.daily[0], { lat: city.lat, lng: city.lng, timeZone: zone }) ?? { rise: 420, set: 1140 };
  const sky = skyState(minute, sun.rise, sun.set);
  const skyRef = useRef<HTMLElement>(null);
  const [revealRef, pre] = useReveal<HTMLDivElement>(score.isSuccess);

  const geometry = useSkyGeometry(skyRef, phone, `${city.id}:${score.status}:${weather.status}`);

  usePhoneHeaderSky(skyRef, sky.phase, phone);

  const label = `${city.name} at a glance`;
  const art = <SkyArt geometry={geometry} sky={sky} rise={sun.rise} set={sun.set} phone={phone} />;
  // The sun's position goes on the sky itself, which also centers its glow there.
  const sunVars = cssVars(sunPosition(geometry, sky, phone));

  if (phone) {
    return (
      <div className={pre ? 'pre' : undefined} ref={revealRef}>
        <section className="sky" data-phase={sky.phase} data-sec="overview" aria-label={label} ref={skyRef} style={sunVars}>
          {art}
          <span className="sky-place">
            <Icon name="pin" size={15} />
            {placeLine(city)}
          </span>
          <h1 className="sky-city">{city.name}</h1>
          <p className="sky-meta">
            <span className="live-dot" />
            <b>{fmtClock(minute)}</b>
            <span className="sep">{formatUtcOffset(utcOffsetMinutes(zone, when))}</span>
            <PhoneDiff zone={zone} when={when} />
          </p>
          <WeatherLine {...props} />
        </section>
        <HeroScore city={city} score={score.data} status={score.status} phone />
        <div className="acts3">
          <SaveButton city={city} className="btn-secondary" size={18} />
          <CompareLink city={city} className="btn btn-secondary" size={18} />
          <button type="button" className="btn btn-secondary" onClick={() => void sharePage(`${city.name} - Remote Radar`, true)}>
            <Icon name="share" size={18} />
            Share
          </button>
        </div>
        <Vitals {...props} phone />
      </div>
    );
  }

  return (
    <div className={`wrap city-hero${pre ? ' pre' : ''}`} ref={revealRef}>
      <section className="sky" data-phase={sky.phase} data-sec="overview" aria-label={label} ref={skyRef} style={sunVars}>
        {art}
        <div className="sky-body">
          <div>
            <span className="sky-place">
              <Icon name="pin" size={16} />
              {placeLine(city)}
            </span>
            <h1 className="sky-city">{city.name}</h1>
            <p className="sky-meta">
              <span className="live-dot" />
              <b>{fmtClock(minute)}</b>
              <span className="sep">{DAYS_LONG[zoneDate(zone, when).weekday]}</span>
              <span className="sep">{formatUtcOffset(utcOffsetMinutes(zone, when))}</span>
              <DeskDiff zone={zone} when={when} />
            </p>
            <p className="sky-sub">
              {formatCoords(city.lat, city.lng)}
              {currencyLabel(city) && <span className="sep">{currencyLabel(city)}</span>}
            </p>
            <div className="sky-actions">
              <SaveButton city={city} className="btn-glass" size={17} />
              <CompareLink city={city} className="btn btn-glass" size={17} />
              <button type="button" className="btn btn-glass" onClick={() => void sharePage(`${city.name} - Remote Radar`, false)}>
                <Icon name="share" size={17} />
                Share
              </button>
              <UnitsToggle units={units} onChange={props.onUnits} glass />
            </div>
          </div>
          <HeroScore city={city} score={score.data} status={score.status} />
        </div>
        <Vitals {...props} />
      </section>
    </div>
  );
}

function DeskDiff({ zone, when }: { zone: string; when: Date }) {
  const homeZone = useHomeZone();
  return <span className="sep">{diffLabel(zone, homeZone, when)}</span>;
}

function PhoneDiff({ zone, when }: { zone: string; when: Date }) {
  const homeZone = useHomeZone();
  return <span className="sep">{diffShort(zone, homeZone, when)}</span>;
}

function CompareLink({ city, className, size }: { city: City; className: string; size: number }) {
  const saved = useSavedCities();
  return (
    <Link className={className} to={compareWith(city, saved)}>
      <Icon name="compare" size={size} />
      Compare
    </Link>
  );
}

/* ---------- Score card ---------- */

function HeroScore({
  city,
  score,
  status,
  phone = false,
}: {
  city: City;
  score: WorkScore | undefined;
  status: 'pending' | 'error' | 'success';
  phone?: boolean;
}) {
  const value = score?.score ?? null;
  const tier = tierOf(value);
  let tierText = tier.label;
  let text: ReactNode = score && value !== null ? verdict(score.factors, phone) : null;
  if (status === 'pending') {
    tierText = '';
    text = (
      <>
        <span className="skel sc-skel" />
        <span className="skel sc-skel short" />
      </>
    );
  } else if (status === 'error') {
    tierText = 'Not available';
    text = "The score couldn't be loaded right now.";
  } else if (score && value === null) {
    tierText = 'Not enough data';
    text = `Only ${score.counted} of ${score.factors.length} factors have data for ${city.name}.`;
  }
  const aria =
    value !== null ? `Remote work score ${value} out of 100, ${tier.label}. See how it's scored.` : 'Remote work score. See how it works.';

  function open(event: MouseEvent) {
    event.preventDefault();
    goToSection('score');
  }

  if (phone) {
    return (
      <a className={`scorecard tier-${tier.key}`} href="#score" onClick={open} aria-label={aria}>
        <Ring score={value} size={76} stroke={7} />
        <div>
          <div className="sc-label">Remote work score</div>
          <div className="sc-tier tier-text">{tierText}</div>
          <p className="sc-verdict">{text}</p>
        </div>
        <Icon name="chevron-right" size={20} />
      </a>
    );
  }

  return (
    <a className={`scorecard tier-${tier.key}`} href="#score" onClick={open} aria-label={aria}>
      <div className="sc-top">
        <Ring score={value} size={76} stroke={7} />
        <div>
          <div className="sc-label">Remote work score</div>
          <div className="sc-tier tier-text">{tierText}</div>
        </div>
      </div>
      <p className="sc-verdict">{text}</p>
      {score && score.factors.length > 0 && (
        <div className="sc-factors">
          {score.factors.map((factor) => (
            <div key={factor.key} className={`sc-factor tier-${tierOf(factor.score).key}`}>
              <span>
                {factor.name}
                <b>{factor.score ?? '–'}</b>
              </span>
              <Bar value={factor.score ?? 0} />
            </div>
          ))}
        </div>
      )}
      <span className="sc-more">
        See how it&apos;s scored
        <Icon name="arrow-down" size={14} />
      </span>
    </a>
  );
}

/* ---------- Key numbers ---------- */

interface VitalProps {
  jump: string;
  icon: IconName;
  label: string;
  /** Null while loading. */
  value: ReactNode | null;
  hint: ReactNode;
  phone: boolean;
}

function Vital({ jump, icon, label, value, hint, phone }: VitalProps) {
  const loading = value === null;
  if (phone) {
    return (
      <button type="button" className="tile4" onClick={() => goToSection(jump)}>
        <span className="label">
          <Icon name={icon} size={15} />
          {label}
        </span>
        {loading ? <span className="skel tile-skel" /> : <b>{value}</b>}
        <span>{loading ? ' ' : hint}</span>
      </button>
    );
  }
  return (
    <button type="button" className="vital" onClick={() => goToSection(jump)}>
      <span className="v-label">
        <Icon name={icon} size={17} />
        {label}
      </span>
      {loading ? <span className="skel vital-skel" /> : <span className="v-value">{value}</span>}
      <span className="v-hint">{loading ? ' ' : hint}</span>
    </button>
  );
}

function Vitals({ dataId, zone, units, stay, phone = false }: HeroProps & { phone?: boolean }) {
  const now = useNow();
  const homeZone = useHomeZone();
  const weather = useWeather(dataId, units);
  const essentials = useEssentials(dataId);
  const places = usePlaces(dataId);
  const stays = useStays(dataId, stay);
  const overlap = workOverlap(homeZone, zone, new Date(now));
  const home = zoneCity(homeZone);

  const current = weather.data?.current;
  const today = weather.data?.daily[0];
  const weatherValue = current ? (
    <>
      {degrees(current.temperature)}
      <small>{current.description}</small>
    </>
  ) : weather.isError ? (
    '–'
  ) : null;

  const internet = essentials.data?.internet;
  const fixed = internet?.fixed;
  const mobile = internet?.mobile;
  const internetValue = essentials.isPending ? null : fixed ? (
    <>
      {Math.round(fixed.download_mbps)}
      <small>Mbps</small>
    </>
  ) : (
    '–'
  );
  const internetHint = fixed
    ? mobile
      ? `${phone ? 'home' : 'home download'}, ${Math.round(mobile.download_mbps)} on mobile`
      : phone
        ? 'home download'
        : 'average home download'
    : 'No speed tests nearby';

  const average = stays.data?.average_price ?? null;
  const local = inLocal(average, essentials.data?.currency);
  const hotelValue = stays.isPending ? null : average !== null ? (
    <>
      {usd(average)}
      <small>/ night</small>
    </>
  ) : (
    '–'
  );
  const hotelHint =
    average === null
      ? 'No prices right now'
      : phone
        ? local
          ? `about ${local}`
          : guestsLabel(stay.occupants)
        : local
          ? `about ${local}, ${guestsLabel(stay.occupants)}`
          : `average, ${guestsLabel(stay.occupants)}`;

  const counts = places.data?.counts;
  const coworkValue = places.isPending ? null : counts ? (
    <>
      {counts.coworking}
      <small>{counts.coworking === 1 ? 'space' : 'spaces'}</small>
    </>
  ) : (
    '–'
  );
  const cafes = counts ? `${counts.coffee} ${counts.coffee === 1 ? 'café' : 'cafés'}` : '';
  const coworkHint = counts ? (phone ? `and ${cafes}` : `and ${cafes} in the city`) : 'Not available right now';

  const overlapValue = shortHours(overlap.minutes);
  const overlapHint = phone ? `with 9 to 5 in ${home}` : `with your 9 to 5 in ${home}`;

  if (phone) {
    return (
      <div className="tiles4">
        <Vital phone jump="work" icon="clock" label="Work overlap" value={overlapValue} hint={overlapHint} />
        <Vital phone jump="work" icon="wifi" label="Internet" value={internetValue} hint={internetHint} />
        <Vital phone jump="stays" icon="bed" label="Hotels" value={hotelValue} hint={hotelHint} />
        <Vital phone jump="places" icon="desk" label="Coworking" value={coworkValue} hint={coworkHint} />
      </div>
    );
  }

  return (
    <div className="vitals">
      <Vital
        phone={false}
        jump="weather"
        icon={current ? weatherIcon(current.weather_code, current.is_day) : 'cloud-sun'}
        label="Weather now"
        value={weatherValue}
        hint={today ? `High ${degrees(today.temperature_max)}, low ${degrees(today.temperature_min)}` : 'Forecast unavailable'}
      />
      <Vital phone={false} jump="work" icon="clock" label="Work overlap" value={overlapValue} hint={overlapHint} />
      <Vital phone={false} jump="work" icon="wifi" label="Internet" value={internetValue} hint={internetHint} />
      <Vital phone={false} jump="stays" icon="bed" label="Hotels" value={hotelValue} hint={hotelHint} />
      <Vital phone={false} jump="places" icon="desk" label="Coworking" value={coworkValue} hint={coworkHint} />
    </div>
  );
}

/** The phone hero's weather line: "18° Clear sky · H 23° L 15°". */
function WeatherLine({ dataId, units }: HeroProps) {
  const weather = useWeather(dataId, units);
  const current = weather.data?.current;
  const today = weather.data?.daily[0];
  if (!current) {
    return <p className="sky-wx">{weather.isError ? 'Weather unavailable right now' : <span className="skel wx-skel" />}</p>;
  }
  return (
    <p className="sky-wx">
      <Icon name={weatherIcon(current.weather_code, current.is_day)} size={18} />
      <b>{degrees(current.temperature)}</b>
      {current.description}
      {today && (
        <span className="sep">
          H {degrees(today.temperature_max)} L {degrees(today.temperature_min)}
        </span>
      )}
    </p>
  );
}

/* ---------- The sky ---------- */

interface Geometry {
  w: number;
  h: number;
  horizon: number;
  /** Bottom of the frosted score card (desktop), so the sunset label stays clear of it. */
  cardBottom: number;
  /** Text inside the sky, padded, so stars never land beside a word and read as punctuation. */
  boxes: [number, number, number, number][];
}

const TEXT = '.sky-place, .sky-city, .sky-meta, .sky-sub, .sky-wx, .sky-actions, .scorecard';

function measureSky(sky: HTMLElement, phone: boolean): Geometry | null {
  const w = sky.offsetWidth;
  const h = sky.offsetHeight;
  if (!w || !h) return null;
  const box = sky.getBoundingClientRect();
  const k = box.width / w || 1;
  const vitals = sky.querySelector<HTMLElement>('.vitals');
  const card = sky.querySelector<HTMLElement>('.scorecard');
  const boxes: Geometry['boxes'] = [];
  sky.querySelectorAll<HTMLElement>(TEXT).forEach((element) => {
    let rects: DOMRect[];
    if (element.classList.contains('scorecard')) {
      rects = [element.getBoundingClientRect()];
    } else {
      const range = document.createRange();
      range.selectNodeContents(element);
      rects = Array.from(range.getClientRects());
    }
    for (const rect of rects) {
      if (!rect.width || !rect.height) continue;
      boxes.push([
        (rect.left - box.left) / k - 10,
        (rect.top - box.top) / k - 8,
        (rect.right - box.left) / k + 10,
        (rect.bottom - box.top) / k + 8,
      ]);
    }
  });
  return {
    w,
    h,
    horizon: phone ? h - 48 : vitals ? vitals.offsetTop : h - 90,
    cardBottom: card ? (card.getBoundingClientRect().bottom - box.top) / k : 0,
    boxes,
  };
}

function sameGeometry(a: Geometry | null, b: Geometry | null) {
  if (!a || !b) return a === b;
  return (
    a.w === b.w &&
    a.h === b.h &&
    a.horizon === b.horizon &&
    Math.round(a.cardBottom) === Math.round(b.cardBottom) &&
    a.boxes.length === b.boxes.length &&
    a.boxes.every((box, i) => box.every((v, j) => Math.round(v) === Math.round(b.boxes[i]?.[j] ?? NaN)))
  );
}

/** Measures the sky once it has its real size, and again whenever it changes. */
function useSkyGeometry(skyRef: RefObject<HTMLElement | null>, phone: boolean, version: string): Geometry | null {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky) return;
    const measure = () => {
      const next = measureSky(sky, phone);
      setGeometry((previous) => (sameGeometry(previous, next) ? previous : next));
    };
    if (typeof ResizeObserver === 'undefined') {
      const frame = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(sky);
    const body = sky.querySelector('.sky-body');
    if (body) observer.observe(body);
    return () => observer.disconnect();
  }, [skyRef, phone, version]);
  return geometry;
}

interface Star {
  key: number;
  x: number;
  y: number;
  r: number;
  delay: number;
  twinkle: boolean;
}

function placeStars(geometry: Geometry, phone: boolean): Star[] {
  const random = seeded(11);
  const count = phone ? 30 : 84;
  const stars: Star[] = [];
  for (let tries = 0; stars.length < count && tries < count * 6; tries++) {
    const x = random() * geometry.w;
    const y = random() * (geometry.horizon - 16);
    const r = 0.6 + random() * 1.1;
    const delay = random() * 4;
    // Phones: never under the see-through header.
    if (phone && y < 60) continue;
    if (geometry.boxes.some(([a, b, c, d]) => x > a && x < c && y > b && y < d)) continue;
    stars.push({ key: stars.length, x, y, r, delay, twinkle: stars.length % 4 === 0 });
  }
  return stars;
}

/** Where the sun (or moon) sits on its arc, as the sky's --sx and --sy. */
function sunPosition(geometry: Geometry | null, sky: SkyState, phone: boolean): Record<string, string> {
  if (!geometry) return { '--sx': '72%', '--sy': '38%' };
  const { w, horizon } = geometry;
  if (phone) {
    return {
      '--sx': `${(w * (0.7 + 0.2 * sky.f)).toFixed(1)}px`,
      '--sy': `${(horizon - (horizon - 86) * Math.sin(Math.PI * sky.f)).toFixed(1)}px`,
    };
  }
  const x0 = w * 0.45;
  const x1 = w - 30;
  const rx = (x1 - x0) / 2;
  return {
    '--sx': `${((x0 + x1) / 2 - rx * Math.cos(Math.PI * sky.f)).toFixed(1)}px`,
    '--sy': `${(horizon - (horizon - 30) * Math.sin(Math.PI * sky.f)).toFixed(1)}px`,
  };
}

/**
 * Stars, the sun's arc and the horizon. Desktop: a wide arc to the right of the name, rising from behind
 * the frosted score card. Phones: the sun keeps to the right-hand side, rising and setting by altitude.
 */
function SkyArt({
  geometry,
  sky,
  rise,
  set,
  phone,
}: {
  geometry: Geometry | null;
  sky: SkyState;
  rise: number;
  set: number;
  phone: boolean;
}) {
  const stars = useMemo(() => (geometry ? placeStars(geometry, phone) : []), [geometry, phone]);

  let arc: ReactNode = null;
  if (geometry && !phone) {
    const { w, horizon, cardBottom } = geometry;
    const x0 = w * 0.45;
    const x1 = w - 30;
    const rx = (x1 - x0) / 2;
    const ry = horizon - 30;
    // The arc runs from the last horizon event to the next: sunrise to sunset by day, sunset to sunrise by night.
    const riseLabel = `Sunrise ${fmtClock(rise)}`;
    const setLabel = `Sunset ${fmtClock(set)}`;
    const [left, right] = sky.moon ? [setLabel, riseLabel] : [riseLabel, setLabel];
    arc = (
      <>
        <path className="arc" d={`M${x0.toFixed(1)} ${horizon} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${horizon}`} />
        <text className="sky-label" x={(x0 + 22).toFixed(1)} y={horizon - 11}>
          {left}
        </text>
        {horizon - 24 > cardBottom && (
          <text className="sky-label" x={(x1 - 22).toFixed(1)} y={horizon - 11} textAnchor="end">
            {right}
          </text>
        )}
      </>
    );
  }

  return (
    <>
      <svg className="sky-art" aria-hidden="true" viewBox={geometry ? `0 0 ${geometry.w} ${geometry.h}` : undefined}>
        {stars.map((star) => (
          <circle
            key={star.key}
            className={`star${star.twinkle ? ' twinkle' : ''}`}
            cx={star.x.toFixed(0)}
            cy={star.y.toFixed(0)}
            r={star.r.toFixed(1)}
            style={{ animationDelay: `${star.delay.toFixed(1)}s` }}
          />
        ))}
        {arc}
        {geometry && <line className="horizon" x1={0} x2={geometry.w} y1={geometry.horizon} y2={geometry.horizon} />}
      </svg>
      {geometry && <span className={`sky-sun${sky.moon ? ' is-moon' : ''}`} />}
    </>
  );
}

/** On phones the header sits on the sky and takes its colors until the sky scrolls away. */
function usePhoneHeaderSky(skyRef: RefObject<HTMLElement | null>, phase: SkyState['phase'], phone: boolean) {
  useEffect(() => {
    if (!phone) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sky = skyRef.current;
      const y = window.scrollY;
      const past = sky ? y > sky.offsetHeight - 70 : true;
      setHeaderSky({ phase, onSky: !past, veiled: !past && y > 2 });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      setHeaderSky(null);
    };
  }, [skyRef, phase, phone]);
}

/** Shapes of the hero while the city loads, so nothing jumps when it arrives. */
export function HeroSkeleton() {
  const phone = useIsPhone();
  const line = (width: string, height: number, radius = 8) => (
    <span className="skel" style={{ display: 'block', width, height, borderRadius: radius }} />
  );
  return (
    <div className="wrap city-hero" aria-busy="true" aria-label="Loading the city">
      <div className="sk-hero">
        <div className="sk-hero-body">
          <div className="sk-lines">
            {line('34%', 14)}
            {line('58%', phone ? 40 : 64, 12)}
            {line('70%', 16)}
            {line('46%', 14)}
            <div className="sk-row">
              {line('92px', 40, 12)}
              {line('112px', 40, 12)}
              {line('86px', 40, 12)}
            </div>
          </div>
          {!phone && (
            <div className="sk-card">
              <div className="sk-row">
                <span className="skel" style={{ width: 76, height: 76, borderRadius: '50%' }} />
                <div className="sk-lines grow">
                  {line('60%', 12)}
                  {line('44%', 20)}
                </div>
              </div>
              {line('100%', 12)}
              {line('86%', 12)}
              {line('100%', 40, 10)}
            </div>
          )}
        </div>
        <div className="sk-vitals">
          {[50, 50, 50, 50, 50].map((_, index) => (
            <div key={index}>
              {line('50%', 11)}
              {line(index === 0 ? '70%' : '64%', 22)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

