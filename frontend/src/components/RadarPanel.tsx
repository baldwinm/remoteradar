import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';

import { api } from '../api/client';
import { cityKeys } from '../api/queries';
import type { Units } from '../api/types';
import { useNow } from '../lib/clock';
import { useIsPhone } from '../lib/layout';
import { diffShort, fmtClock, localMinutes, utcOffsetMinutes } from '../lib/time';
import { degrees } from '../lib/units';
import { weatherIcon } from '../lib/weatherIcons';
import { FEATURED, type FeaturedCity, WORLD, landDots, project, zonePoint } from '../lib/world';
import Icon from './Icon';

/* The home page radar: the world as dots, the visitor placed by their time zone, and a sweep that
   lights up popular cities as it passes, with a card showing each one's time and weather. */

const PERIOD = 7000;
const TRAIL = 1.15;
const DECAY = 2.4;
const TWO_PI = Math.PI * 2;
// Where the sweep sits when motion is turned off: a still frame with two cards.
const STILL_ANGLE = 4.2;
const STILL_CARDS = ['lisbon--pt', 'tokyo--jp'];

type Rgb = [number, number, number];

let probe: CanvasRenderingContext2D | null | undefined;

/** Any CSS color as [r, g, b], via a scratch canvas. */
function toRgb(color: string): Rgb {
  if (probe === undefined) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return [160, 250, 120];
  probe.fillStyle = '#000';
  probe.fillStyle = color || '#888';
  const value = String(probe.fillStyle);
  if (value.startsWith('#')) {
    const n = parseInt(value.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const [r = 0, g = 0, b = 0] = value
    .replace(/[^\d,.]/g, '')
    .split(',')
    .map(Number);
  return [r, g, b];
}

const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r},${g},${b},${alpha.toFixed(3)})`;

function angleFrom(from: [number, number], x: number, y: number) {
  const angle = Math.atan2(y - from[1], x - from[0]);
  return angle < 0 ? angle + TWO_PI : angle;
}

const at = (x: number, y: number) => ({ left: `${(x / 10).toFixed(2)}%`, top: `${((y / WORLD.h) * 100).toFixed(2)}%` });

function subscribeMotion(listener: () => void) {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    () => false,
  );
}

interface Blip {
  city: FeaturedCity;
  x: number;
  y: number;
  angle: number;
}

interface Props {
  units: Units;
  homeZone: string;
}

export default function RadarPanel({ units, homeZone }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const reduced = useReducedMotion();
  const offset = utcOffsetMinutes(homeZone, new Date(now));
  const [youX, youY] = useMemo(() => zonePoint(homeZone, offset), [homeZone, offset]);
  const blips = useMemo<Blip[]>(
    () =>
      FEATURED.map((city) => {
        const [x, y] = project(city.lng, city.lat);
        return { city, x, y, angle: angleFrom([youX, youY], x, y) };
      }),
    [youX, youY],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blipRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [card, setCard] = useState<{ id: string; seq: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const you: [number, number] = [youX, youY];
    const dots = landDots().map(([x, y]) => [x, y, angleFrom(you, x, y)] as const);
    const style = getComputedStyle(canvas);
    const ink = toRgb(style.getPropertyValue('--scope-ink').trim());
    const green = toRgb(style.getPropertyValue('--radar').trim());
    let base: HTMLCanvasElement | null = null;
    let size = '';
    let radius = 1.5;

    // The land dots and range rings don't move, so they're drawn once per size.
    function resize() {
      if (!canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.offsetWidth * dpr));
      const h = Math.max(1, Math.round(canvas.offsetHeight * dpr));
      const key = `${w}x${h}`;
      if (key === size) return;
      size = key;
      canvas.width = w;
      canvas.height = h;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const layer = off.getContext('2d');
      if (!layer) return;
      const sx = w / WORLD.w;
      const sy = h / WORLD.h;
      layer.setTransform(sx, 0, 0, sy, 0, 0);
      radius = Math.max(1.35, 1.7 * (sx > 1.5 ? 1 : 0.95));
      layer.fillStyle = rgba(ink, 0.3);
      for (const [x, y] of dots) {
        layer.beginPath();
        layer.arc(x, y, radius, 0, TWO_PI);
        layer.fill();
      }
      layer.strokeStyle = rgba(green, 0.32);
      layer.lineWidth = 1 / sx;
      for (const r of [90, 180, 270, 360]) {
        layer.beginPath();
        layer.ellipse(you[0], you[1], r, r * (sx / sy), 0, 0, TWO_PI);
        layer.stroke();
      }
      base = off;
    }

    function draw(theta: number) {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const sx = w / WORLD.w;
      const sy = h / WORLD.h;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (base) ctx.drawImage(base, 0, 0);
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      // The sweep: a fading wedge behind a bright leading line.
      const reach = 1200;
      if (typeof ctx.createConicGradient === 'function') {
        const gradient = ctx.createConicGradient(theta - TRAIL, you[0], you[1]);
        const end = TRAIL / TWO_PI;
        gradient.addColorStop(0, rgba(green, 0));
        gradient.addColorStop(end * 0.999, rgba(green, 0.2));
        gradient.addColorStop(end, rgba(green, 0));
        gradient.addColorStop(1, rgba(green, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(you[0], you[1]);
        ctx.arc(you[0], you[1], reach, theta - TRAIL, theta);
        ctx.closePath();
        ctx.fill();
      } else {
        for (let i = 0; i < 18; i++) {
          const from = theta - TRAIL + (TRAIL * i) / 18;
          ctx.fillStyle = rgba(green, (0.2 * i) / 18);
          ctx.beginPath();
          ctx.moveTo(you[0], you[1]);
          ctx.arc(you[0], you[1], reach, from, from + TRAIL / 18 + 0.01);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.strokeStyle = rgba(green, 0.7);
      ctx.lineWidth = 1.4 / sx;
      ctx.beginPath();
      ctx.moveTo(you[0], you[1]);
      ctx.lineTo(you[0] + Math.cos(theta) * reach, you[1] + Math.sin(theta) * reach);
      ctx.stroke();
      // Land the sweep just passed glows, then fades.
      for (const [x, y, angle] of dots) {
        const behind = (((theta - angle) % TWO_PI) + TWO_PI) % TWO_PI;
        if (behind > DECAY) continue;
        const k = 1 - behind / DECAY;
        ctx.fillStyle = rgba(green, 0.15 + 0.75 * k * k);
        ctx.beginPath();
        ctx.arc(x, y, radius * (1 + 0.25 * k), 0, TWO_PI);
        ctx.fill();
      }
    }

    if (reduced) {
      const still = () => {
        resize();
        draw(STILL_ANGLE);
      };
      still();
      const observer = new ResizeObserver(still);
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    let frame = 0;
    let last = 0;
    let previous = -1;
    let visible = false;
    let cardAt = -Infinity;
    let lastHit: string | null = null;
    let shown: string | null = null;
    let seq = 0;
    const timers = new Set<number>();

    function flash(id: string) {
      const element = blipRefs.current.get(id);
      if (!element) return;
      element.classList.remove('is-hot');
      void element.offsetWidth;
      element.classList.add('is-hot');
      const timer = window.setTimeout(() => {
        element.classList.remove('is-hot');
        timers.delete(timer);
      }, 1400);
      timers.add(timer);
    }

    function tick(time: number) {
      frame = 0;
      // Runs only while the radar is on screen and the tab is showing.
      if (!visible || document.hidden) return;
      frame = requestAnimationFrame(tick);
      if (time - last < 30) return;
      last = time;
      resize();
      const theta = ((time % PERIOD) / PERIOD) * TWO_PI;
      draw(theta);
      if (previous >= 0) {
        for (const blip of blips) {
          const crossed =
            previous <= theta
              ? blip.angle > previous && blip.angle <= theta
              : blip.angle > previous || blip.angle <= theta;
          if (crossed) {
            flash(blip.city.id);
            lastHit = blip.city.id;
          }
        }
      }
      previous = theta;
      if (lastHit && lastHit !== shown && time - cardAt > 2600) {
        cardAt = time;
        shown = lastHit;
        seq += 1;
        setCard({ id: lastHit, seq });
      }
    }

    function start() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      start();
    });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', start);
    resize();
    draw(0);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', start);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [youX, youY, blips, reduced]);

  const when = new Date(now);
  const cards = reduced
    ? STILL_CARDS.map((id, index) => ({ id, key: id, below: index === 1 }))
    : card
      ? [{ id: card.id, key: String(card.seq), below: false }]
      : [];

  return (
    <div className="radar-panel">
      <div className="rp-top">
        <span>
          <span className="live-dot" />
          <b>Right now around the world</b>
        </span>
        {!phone && <span>Local time and weather in popular cities</span>}
      </div>
      <div className="rp-map">
        <canvas ref={canvasRef} aria-hidden="true" />
        {blips.map((blip) => (
          <Link
            key={blip.city.id}
            ref={(element) => {
              if (element) blipRefs.current.set(blip.city.id, element);
              else blipRefs.current.delete(blip.city.id);
            }}
            to={`/city/${encodeURIComponent(blip.city.id)}`}
            className="rp-blip"
            style={at(blip.x, blip.y)}
            aria-label={`${blip.city.name}, ${blip.city.country}`}
          />
        ))}
        <div className={`rp-you${youX < 150 ? ' tag-r' : ''}`} style={at(youX, youY)}>
          <i />
          <b>You</b>
        </div>
        {cards.map((item) => {
          const blip = blips.find((entry) => entry.city.id === item.id);
          return blip ? (
            <RadarCard
              key={item.key}
              blip={blip}
              below={item.below || blip.y < 120}
              units={units}
              homeZone={homeZone}
              when={when}
            />
          ) : null;
        })}
      </div>
      <div className="rp-foot">
        <span className="rp-legend">
          <i className="you" />
          You, placed by your time zone, never your IP
        </span>
        {!phone && (
          <span className="rp-legend">
            <i />
            Popular cities. Select one to open it.
          </span>
        )}
        <span>It's {fmtClock(localMinutes(homeZone, when))} for you</span>
      </div>
    </div>
  );
}

interface CardProps {
  blip: Blip;
  below: boolean;
  units: Units;
  homeZone: string;
  when: Date;
}

function RadarCard({ blip, below, units, homeZone, when }: CardProps) {
  const { city } = blip;
  // Popular cities are shared by every visitor, so their weather stays fresh for a while.
  const weather = useQuery({
    queryKey: cityKeys.weather(city.id, units),
    queryFn: ({ signal }) => api.weather(city.id, units, signal),
    staleTime: 30 * 60 * 1000,
  });
  const current = weather.data?.current;
  return (
    <div className={`rp-card${below ? ' below' : ''}`} style={at(blip.x, blip.y)} aria-hidden="true">
      <b>{city.name}</b>
      {current && current.temperature !== null && (
        <span>
          <Icon name={weatherIcon(current.weather_code, current.is_day)} size={14} />
          <em>{degrees(current.temperature)}</em>
          {current.description}
        </span>
      )}
      <span>
        {fmtClock(localMinutes(city.zone, when))}
        <span className="sep">{diffShort(city.zone, homeZone, when)}</span>
      </span>
    </div>
  );
}

/** Phones: one line of popular cities' local times instead of the radar map. */
export function RadarTicker({ homeZone }: { homeZone: string }) {
  const now = useNow();
  const when = new Date(now);
  return (
    <div className="rp-ticker" role="group" aria-label="Right now in popular cities">
      <span className="live-dot" aria-hidden="true" />
      <span className="rp-ticker-label">Right now</span>
      {FEATURED.slice(0, 8).map((city) => (
        <Link key={city.id} to={`/city/${encodeURIComponent(city.id)}`}>
          <b>{city.name}</b> {fmtClock(localMinutes(city.zone, when))}
          <span className="sr-only">, {diffShort(city.zone, homeZone, when)}</span>
        </Link>
      ))}
    </div>
  );
}
