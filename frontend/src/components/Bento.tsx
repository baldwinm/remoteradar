import type { ReactNode } from 'react';

import type { Units } from '../api/types';
import { smoothPath, seeded } from '../lib/charts';
import { useNow } from '../lib/clock';
import { useIsPhone } from '../lib/layout';
import { fmtClock, shortHours, workOverlap } from '../lib/time';
import { zoneCity } from '../lib/world';
import { DotPlot } from './charts';
import Icon, { type IconName } from './Icon';
import { cssVars } from './ui';

/* "Everything you'd check before you book": one tile per part of a city page, each with a small
   preview drawn from example numbers for Lisbon. The working-hours tile uses the visitor's own
   time zone. */

const toF = (celsius: number) => (celsius * 9) / 5 + 32;
const deg = (celsius: number, units: Units) => `${Math.round(units === 'imperial' ? toF(celsius) : celsius)}°`;
const pct = (minutes: number) => +((minutes / 1440) * 100).toFixed(2);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// A mild October week, then the climate by month: [low, high, best].
const WEEK: { hi: number; icon: IconName }[] = [
  { hi: 23, icon: 'sun' },
  { hi: 22, icon: 'cloud-sun' },
  { hi: 20, icon: 'rain' },
  { hi: 19, icon: 'drizzle' },
  { hi: 21, icon: 'cloud-sun' },
  { hi: 23, icon: 'sun' },
  { hi: 24, icon: 'sun' },
];

const CLIMATE: [number, number, boolean][] = [
  [8, 15, false],
  [9, 16, false],
  [11, 19, false],
  [12, 20, false],
  [14, 23, true],
  [17, 27, true],
  [18, 29, false],
  [19, 29, false],
  [18, 27, true],
  [15, 23, true],
  [12, 18, false],
  [9, 16, false],
];

const HOTEL_PRICES = [
  52, 58, 61, 66, 72, 78, 79, 84, 88, 91, 94, 97, 99, 104, 108, 112, 115, 118, 121, 124, 128, 131, 134, 138, 142, 147, 152,
  155, 161, 164, 172, 181, 196, 214, 238, 262, 286, 341,
];

/** A day of temperatures between 15° and 23°, warmest mid-afternoon. */
function dayCurve(): [number, number][] {
  const rise = 461;
  const peak = 15 * 60;
  const points: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const minute = (i * 60 + 360) % 1440;
    let f: number;
    if (minute >= rise && minute <= peak) f = (1 - Math.cos((Math.PI * (minute - rise)) / (peak - rise))) / 2;
    else {
      const span = 1440 - (peak - rise);
      const since = minute > peak ? minute - peak : minute + 1440 - peak;
      f = (1 + Math.cos((Math.PI * since) / span)) / 2;
    }
    points.push([10 + i * 18.3, 70 - ((15 + 8 * f - 14) / 10) * 52]);
  }
  return points;
}

const CURVE = dayCurve();
const CURVE_PATH = smoothPath(CURVE);

function Sparkline() {
  const now = CURVE[9]!;
  return (
    <svg className="mini-spark" viewBox="0 0 460 92" aria-hidden="true">
      <defs>
        <linearGradient id="ms-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="spark-stop-top" />
          <stop offset="1" className="spark-stop-bottom" />
        </linearGradient>
      </defs>
      <path d={`${CURVE_PATH} L450 92 L10 92 Z`} fill="url(#ms-fill)" />
      <path d={CURVE_PATH} className="spark-line" />
      <circle cx={now[0]} cy={now[1]} r={5} className="spark-now" />
    </svg>
  );
}

/* ---------- The drawn map of central Lisbon ---------- */

const PARKS: { d: string; box: [number, number, number, number] }[] = [
  { d: 'M0 170 C70 150 140 196 156 262 S146 420 96 470 S0 506 0 486 Z', box: [0, 150, 160, 510] },
  { d: 'M438 138 L522 150 L514 272 L430 262 Z', box: [425, 132, 528, 278] },
  { d: 'M252 440 a34 24 0 1 0 68 0 a34 24 0 1 0 -68 0', box: [248, 412, 324, 468] },
  { d: 'M414 372 a14 12 0 1 0 28 0 a14 12 0 1 0 -28 0', box: [410, 356, 446, 388] },
  { d: 'M610 40 L700 52 L692 96 L604 88 Z', box: [600, 36, 706, 100] },
];

const MAJOR = [
  'M0 664 C160 652 300 654 420 662 S600 650 700 612 S880 560 1000 528',
  'M538 610 C522 500 500 380 476 270',
  'M476 270 C510 200 556 120 600 0',
  'M600 548 C620 440 640 330 650 250 S690 120 708 0',
  'M0 118 C200 100 400 92 600 80 S860 64 1000 58',
  'M196 654 C210 560 228 470 262 380 S300 280 320 200',
];

const MINOR = [
  'M430 380 C400 360 370 340 344 300 S310 250 300 200',
  'M300 470 C340 520 380 560 430 596',
  'M476 270 C420 300 380 330 344 300',
  'M538 610 L640 560 L700 520',
  'M500 600 L520 520 M560 600 L580 520 M600 590 L560 530',
  'M120 560 C180 520 230 480 262 440',
  'M650 250 C700 260 760 240 820 230 S940 210 1000 200',
  'M700 520 C760 470 820 440 900 420',
  'M262 380 C320 400 380 420 430 380',
  'M760 0 C770 120 780 240 820 330 S880 440 900 420',
];

const WATER = 'M0 676 C120 674 240 672 360 672 S540 690 640 650 S820 600 1000 558 L1000 800 L0 800 Z';

const LABELS: [string, number, number][] = [
  ['Baixa', 552, 612],
  ['Alfama', 722, 600],
  ['Chiado', 470, 512],
  ['Príncipe Real', 418, 342],
  ['Estrela', 288, 404],
  ['Santos', 332, 644],
  ['Graça', 690, 466],
  ['Avenidas Novas', 590, 196],
  ['Campo de Ourique', 214, 380],
  ['Arroios', 700, 300],
];

const PINS: { type: 'coffee' | 'coworking' | 'restaurant'; x: number; y: number }[] = [
  { type: 'coworking', x: 428, y: 598 },
  { type: 'coworking', x: 402, y: 392 },
  { type: 'coworking', x: 548, y: 556 },
  { type: 'coffee', x: 318, y: 612 },
  { type: 'coffee', x: 662, y: 442 },
  { type: 'coffee', x: 300, y: 474 },
  { type: 'coffee', x: 664, y: 552 },
  { type: 'coffee', x: 498, y: 540 },
  { type: 'restaurant', x: 462, y: 624 },
  { type: 'restaurant', x: 700, y: 574 },
  { type: 'restaurant', x: 664, y: 272 },
  { type: 'restaurant', x: 232, y: 420 },
];

function shore(x: number) {
  if (x < 360) return 676 - (x / 360) * 4;
  if (x < 640) return 672 + Math.sin(((x - 360) / 280) * Math.PI) * 10 - ((x - 360) / 280) * 22;
  return 650 - ((x - 640) / 360) * 92;
}

/** City blocks on a jittered grid, skipping the river and the parks. */
function cityBlocks() {
  const random = seeded(7);
  const blocks: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 14; y < 800; y += 34) {
    for (let x = 10; x < 1000; x += 42) {
      const w = 26 + random() * 10;
      const h = 20 + random() * 8;
      const bx = x + random() * 6;
      const by = y + random() * 5;
      if (by + h > shore(bx + w / 2) - 14) continue;
      if (PARKS.some(({ box }) => bx + w > box[0] && bx < box[2] && by + h > box[1] && by < box[3])) continue;
      if (random() < 0.08) continue;
      blocks.push({ x: Math.round(bx), y: Math.round(by), w: Math.round(w), h: Math.round(h) });
    }
  }
  return blocks;
}

const BLOCKS = cityBlocks();

function MiniMap() {
  return (
    <svg viewBox="230 380 600 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path className="m-water" d={WATER} />
      {PARKS.map((park) => (
        <path key={park.d} className="m-park" d={park.d} />
      ))}
      <g className="m-block">
        {BLOCKS.map((block) => (
          <rect key={`${block.x}-${block.y}`} x={block.x} y={block.y} width={block.w} height={block.h} rx={4} />
        ))}
      </g>
      {MINOR.map((d) => (
        <path key={`mc${d}`} className="m-casing" d={d} strokeWidth={7} />
      ))}
      {MAJOR.map((d) => (
        <path key={`Mc${d}`} className="m-casing" d={d} strokeWidth={12} />
      ))}
      {MINOR.map((d) => (
        <path key={`mr${d}`} className="m-road" d={d} strokeWidth={4} />
      ))}
      {MAJOR.map((d) => (
        <path key={`Mr${d}`} className="m-road" d={d} strokeWidth={8} />
      ))}
      {LABELS.map(([text, x, y]) => (
        <text key={text} className="m-label" x={x} y={y} textAnchor="middle">
          {text}
        </text>
      ))}
      <text className="m-label water" x={760} y={720} textAnchor="middle">
        RIO TEJO
      </text>
      <circle className="center-halo" cx={548} cy={586} r={34} />
      <circle className="center-mark" cx={548} cy={586} r={8} />
      {PINS.map((pin, index) => (
        <g key={`${pin.x}-${pin.y}`} className={`pin pin-${pin.type}${index === 0 ? ' is-hot' : ''}`}>
          <circle cx={pin.x} cy={pin.y} r={10} />
        </g>
      ))}
    </svg>
  );
}

/* ---------- Tiles ---------- */

interface Tile {
  span: number;
  icon: IconName;
  title: string;
  text: string;
  bleed?: boolean;
  viz: ReactNode;
}

interface Props {
  units: Units;
  homeZone: string;
}

export default function Bento({ units, homeZone }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const today = new Date(now).getDay();
  const overlap = workOverlap(homeZone, 'Europe/Lisbon', new Date(now));
  const tiles: Tile[] = [
    {
      span: 5,
      icon: 'cloud-sun',
      title: 'Weather, hour by hour',
      text: 'Conditions now, the next 24 hours and the week ahead, with sunrise and sunset.',
      viz: (
        <>
          <Sparkline />
          <div className="mini-days">
            {WEEK.map((day, index) => (
              <span key={index}>
                {index === 0 ? 'Today' : DAYS[(today + index) % 7]}
                <Icon name={day.icon} size={20} />
                <b>{deg(day.hi, units)}</b>
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      span: 7,
      icon: 'clock',
      title: 'Your working hours',
      text: "See which hours of your 9 to 5 overlap with the city's, from whatever time zone you're in.",
      viz: (
        <>
          <div className="mini-price">
            <b>{overlap.minutes ? shortHours(overlap.minutes) : 'None'}</b>
            <span>of your 9 to 5 lines up with Lisbon's, seen from {zoneCity(homeZone)}</span>
          </div>
          <div className="mini-lanes">
            <div className="mini-lane">
              <span>Lisbon 9 to 5</span>
              <div className="mini-track">
                <i className="city" style={cssVars({ '--a': '37.5%', '--w': '33.33%' })} />
              </div>
            </div>
            <div className="mini-lane">
              <span>Your 9 to 5</span>
              <div className="mini-track">
                {overlap.homeSpans.map(([start, end]) => (
                  <i key={start} className="you" style={cssVars({ '--a': `${pct(start)}%`, '--w': `${pct(end - start)}%` })} />
                ))}
              </div>
            </div>
            {overlap.minutes > 0 && (
              <div
                className="mini-band"
                style={cssVars({ '--a': pct(overlap.cityStart), '--w': pct(overlap.cityEnd - overlap.cityStart) })}
              />
            )}
          </div>
          <div className="mini-axis" aria-hidden="true">
            {[0, 6, 12, 18, 24].map((hour) => (
              <span key={hour} style={cssVars({ '--at': `${(hour / 24) * 100}%` })}>
                {fmtClock(hour * 60, true)}
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      span: 7,
      icon: 'pin',
      title: 'Places to work, eat and live',
      text: 'Coffee shops and coworking spaces with live opening hours, plus restaurants, gyms, parks and laundry.',
      bleed: true,
      viz: (
        <div className="mini-map">
          <div className="map">
            <MiniMap />
          </div>
          <div className="mini-place" style={cssVars({ '--tint': 'var(--pin-coworking)' })}>
            <span className="tile">
              <Icon name="desk" size={18} />
            </span>
            <span>
              <b>Coworking in Cais do Sodré</b>
              <small>
                <span className="rating">
                  <Icon name="star" size={11} className="star" />
                  4.8
                </span>
                <span className="sep open">Open until 10&nbsp;PM</span>
              </small>
            </span>
          </div>
        </div>
      ),
    },
    {
      span: 5,
      icon: 'bed',
      title: 'What a night costs',
      text: 'Average hotel prices for your dates, from one night to a month, in dollars and local money.',
      viz: (
        <>
          <div className="mini-price">
            <b>$142</b>
            <span>a night in Lisbon, about €122</span>
          </div>
          <DotPlot prices={HOTEL_PRICES} average={142} width={460} height={100} />
        </>
      ),
    },
    {
      span: 4,
      icon: 'wifi',
      title: 'Internet you can count on',
      text: 'Typical home and mobile speeds from millions of real speed tests.',
      viz: (
        <>
          <MiniSpeed label="Home" value={164} share={82} />
          <MiniSpeed label="Mobile" value={72} share={36} />
        </>
      ),
    },
    {
      span: 4,
      icon: 'calendar',
      title: 'Best time to go',
      text: 'Five years of weather by month, with the mildest, driest months marked.',
      viz: (
        <>
          <div className="mini-months">
            {CLIMATE.map(([low, high, best], index) => (
              <span
                key={index}
                className={best ? 'best' : undefined}
                style={cssVars({ '--lo': ((low - 5) / 30) * 100, '--hi': ((high - 5) / 30) * 100 })}
              >
                <i />
              </span>
            ))}
          </div>
          <div className="mini-mlabels">
            {CLIMATE.map(([, , best], index) => (
              <span key={index} className={best ? 'best' : undefined}>
                {MONTH_LETTERS[index]}
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      span: 4,
      icon: 'cash',
      title: 'Money and holidays',
      text: "Today's exchange rate and the public holidays coming up.",
      viz: (
        <>
          <div className="mini-rate">
            €0.86<small>to the dollar</small>
          </div>
          <div className="mini-hols">
            {[
              ['NOV', 1],
              ['DEC', 1],
              ['DEC', 8],
            ].map(([month, day]) => (
              <span key={`${month}${day}`} className="cal-tile">
                <small>{month}</small>
                <b>{day}</b>
              </span>
            ))}
          </div>
        </>
      ),
    },
  ];

  return (
    <section className="feat" aria-labelledby="feat-title">
      <div className="wrap">
        <div className="feat-head">
          <span className="sec-kicker">
            <Icon name="layers" size={16} />
            One page per city
          </span>
          <h2 id="feat-title">Everything you'd check before you book</h2>
          <p>
            Live data from trusted sources, laid out so you can size up a city in a minute.
            {phone ? ' ' : <br />}
            The previews below use Lisbon as an example.
          </p>
        </div>
        <div className="bento">
          {tiles.map((tile) => (
            <article key={tile.title} className="bt" style={cssVars({ '--span': tile.span })}>
              <div className="bt-top">
                <span className="tile">
                  <Icon name={tile.icon} size={20} />
                </span>
                <h3>{tile.title}</h3>
              </div>
              <p>{tile.text}</p>
              <div className={`bt-viz${tile.bleed ? ' bleed' : ''}`}>{tile.viz}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniSpeed({ label, value, share }: { label: string; value: number; share: number }) {
  return (
    <div className="speed">
      <div className="speed-top">
        <span className="label">{label}</span>
        <span className="speed-val">
          {value}
          <small>Mbps</small>
        </span>
      </div>
      <div className="speed-bar" style={cssVars({ '--v': share, '--m': 50 })}>
        <i />
        <em />
      </div>
    </div>
  );
}
