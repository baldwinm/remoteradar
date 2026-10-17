import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useCity, useClimate, useEssentials, usePlaces, useStays, useWeather } from '../api/queries';
import type { ClimateMonth, Units, Weather } from '../api/types';
import { smoothPath, seeded } from '../lib/charts';
import { useNow } from '../lib/clock';
import { shortWeekday } from '../lib/format';
import { useIsPhone } from '../lib/layout';
import { fmtClock, openState, shortHours, workOverlap, zoneDate } from '../lib/time';
import { degrees } from '../lib/units';
import { weatherIcon } from '../lib/weatherIcons';
import { zoneCity } from '../lib/world';
import { DotPlot } from './charts';
import { inLocal, usd } from './city/common';
import Icon, { type IconName } from './Icon';
import { cssVars } from './ui';

/* "What a city page shows": one tile per part of a city page, each a link to that part of Lisbon's
   page, with the same live numbers it shows there. The working-hours tile uses the visitor's own
   time zone. On phones, three tiles in a swipe row. */

const EXAMPLE = 'lisbon--pt';
const ZONE = 'Europe/Lisbon';
// The hotel numbers match the city page as it first opens: one guest, one night.
const STAY = { occupants: 1, nights: 1 };
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pct = (minutes: number) => +((minutes / 1440) * 100).toFixed(2);
const pad = (value: number) => String(value).padStart(2, '0');

/** A short grey bar where a number goes while it loads. */
const Loading = ({ wide = false }: { wide?: boolean }) => <span className={`skel bt-skel${wide ? ' wide' : ''}`} />;

/** The next 24 hours of temperatures as a line, with a dot on now. */
function Sparkline({ weather, when }: { weather: Weather; when: Date }) {
  const local = zoneDate(weather.timezone, when);
  const thisHour = `${local.year}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}`;
  const temps = weather.hourly
    .filter((hour) => hour.time.slice(0, 13) >= thisHour && hour.temperature !== null)
    .slice(0, 25)
    .map((hour) => hour.temperature as number);
  if (temps.length < 2) return null;
  const lo = Math.min(...temps);
  const span = Math.max(1, Math.max(...temps) - lo);
  const points = temps.map((temp, index): [number, number] => [
    10 + (index / (temps.length - 1)) * 440,
    74 - ((temp - lo) / span) * 56,
  ]);
  const path = smoothPath(points);
  const now = points[0]!;
  return (
    <svg className="mini-spark" viewBox="0 0 460 92" aria-hidden="true">
      <defs>
        <linearGradient id="ms-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="spark-stop-top" />
          <stop offset="1" className="spark-stop-bottom" />
        </linearGradient>
      </defs>
      <path d={`${path} L450 92 L10 92 Z`} fill="url(#ms-fill)" />
      <path d={path} className="spark-line" />
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
  key: string;
  span: number;
  icon: IconName;
  title: string;
  text: string;
  /** The part of Lisbon's page the tile opens, and the words for the link. */
  section: string;
  go: string;
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
  const when = new Date(now);
  const city = useCity(EXAMPLE);
  // Sections load by the city's full ID, the same requests the Lisbon page makes.
  const id = city.data?.id ?? '';
  const weather = useWeather(id, units);
  const essentials = useEssentials(id);
  const stays = useStays(id, STAY);
  const places = usePlaces(id);
  const climate = useClimate(phone ? '' : id, units);
  const overlap = workOverlap(homeZone, ZONE, when);

  const currency = essentials.data?.currency;
  const average = stays.data?.average_price ?? null;
  const prices = (stays.data?.stays ?? []).flatMap((stay) => (stay.price_per_night === null ? [] : [stay.price_per_night]));
  const local = inLocal(average, currency);
  const coworking = (places.data?.places ?? [])
    .filter((place) => place.type === 'coworking')
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const spaces = places.data?.counts.coworking;
  const cafes = places.data?.counts.coffee;
  const open = coworking ? openState(coworking.opening_hours, ZONE, when) : null;
  const internet = essentials.data?.internet;
  const rate = currency?.usd_rate ?? null;
  const holidays = essentials.data?.holidays ?? [];
  const forecast = weather.data;
  const current = forecast?.current;

  const hours: Tile = {
    key: 'hours',
    span: 7,
    icon: 'clock',
    title: 'Your working hours',
    text: "Which hours of your 9 to 5 line up with the city's, from whatever time zone you're in.",
    section: 'work',
    go: "See Lisbon's hours",
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
  };

  const hotels: Tile = {
    key: 'hotels',
    span: 5,
    icon: 'bed',
    title: 'What a night costs',
    text: 'Average hotel prices for your dates, from one night to a month, in dollars and local money.',
    section: 'stays',
    go: "See Lisbon's hotels",
    viz: (
      <>
        <div className="mini-price">
          {average !== null ? <b>{usd(average)}</b> : stays.isError ? <b>–</b> : <Loading />}
          <span>
            {stays.isError && average === null
              ? "Hotel prices didn't load just now"
              : `a night in Lisbon${local ? `, about ${local}` : ''}`}
          </span>
        </div>
        {!phone && prices.length > 1 && average !== null && (
          <DotPlot prices={prices} average={average} width={460} height={100} />
        )}
      </>
    ),
  };

  const workPlaces: Tile = {
    key: 'places',
    span: 7,
    icon: 'pin',
    title: 'Places to work, eat and live',
    text: 'Coffee shops and coworking spaces with live opening hours, plus restaurants, gyms, parks and laundry.',
    section: 'places',
    go: "See Lisbon's places",
    bleed: !phone,
    viz: phone ? (
      <div className="mini-price">
        {spaces !== undefined ? <b>{spaces}</b> : places.isError ? <b>–</b> : <Loading />}
        <span>coworking{cafes !== undefined ? `, ${cafes} cafés` : ''}</span>
      </div>
    ) : (
      <div className="mini-map">
        <div className="map">
          <MiniMap />
        </div>
        {coworking && (
          <div className="mini-place" style={cssVars({ '--tint': 'var(--pin-coworking)' })}>
            <span className="tile">
              <Icon name="desk" size={18} />
            </span>
            <span>
              <b>{coworking.name}</b>
              <small>
                {coworking.rating !== null && (
                  <span className="rating">
                    <Icon name="star" size={11} className="star" />
                    {coworking.rating.toFixed(1)}
                  </span>
                )}
                {open && <span className={`sep${open.open ? ' open' : ''}`}>{open.label}</span>}
              </small>
            </span>
          </div>
        )}
      </div>
    ),
  };

  const tiles: Tile[] = phone
    ? [hours, hotels, workPlaces]
    : [
        {
          key: 'weather',
          span: 5,
          icon: 'cloud-sun',
          title: 'Weather, hour by hour',
          text: 'Conditions now, the next 24 hours and the week ahead, with sunrise and sunset.',
          section: 'weather',
          go: "See Lisbon's forecast",
          viz: forecast ? (
            <>
              <div className="mini-price">
                <b>{degrees(current?.temperature)}</b>
                <span>{current?.description} in Lisbon now</span>
              </div>
              <Sparkline weather={forecast} when={when} />
              <div className="mini-days">
                {forecast.daily.slice(0, 7).map((day, index) => (
                  <span key={day.date}>
                    {index === 0 ? 'Today' : shortWeekday(day.date)}
                    <Icon name={weatherIcon(day.weather_code, true)} size={20} />
                    <b>{degrees(day.temperature_max)}</b>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mini-price">{weather.isError ? <span>The forecast didn&apos;t load just now</span> : <Loading wide />}</div>
          ),
        },
        hours,
        workPlaces,
        hotels,
        {
          key: 'internet',
          span: 4,
          icon: 'wifi',
          title: 'Internet you can count on',
          text: 'Typical home and mobile speeds from millions of real speed tests.',
          section: 'work',
          go: "See Lisbon's internet",
          viz: internet?.fixed || internet?.mobile ? (
            <>
              {internet.fixed && <MiniSpeed label="Home" value={Math.round(internet.fixed.download_mbps)} />}
              {internet.mobile && <MiniSpeed label="Mobile" value={Math.round(internet.mobile.download_mbps)} />}
            </>
          ) : (
            <div className="mini-price">{essentials.isPending ? <Loading wide /> : <span>No speed data just now</span>}</div>
          ),
        },
        {
          key: 'climate',
          span: 4,
          icon: 'calendar',
          title: 'Best time to go',
          text: 'Five years of weather by month, with the mildest, driest months marked.',
          section: 'climate',
          go: "See Lisbon's months",
          viz: <MiniClimate months={climate.data?.months} />,
        },
        {
          key: 'money',
          span: 4,
          icon: 'cash',
          title: 'Money and holidays',
          text: "Today's exchange rate and the public holidays coming up.",
          section: 'work',
          go: "See Lisbon's money",
          viz: (
            <>
              <div className="mini-rate">
                {rate !== null && currency ? (
                  <>
                    {currency.symbol || `${currency.code} `}
                    {rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <small>to the dollar</small>
                  </>
                ) : essentials.isPending ? (
                  <Loading />
                ) : (
                  <small>No rate just now</small>
                )}
              </div>
              {holidays.length > 0 && (
                <div className="mini-hols">
                  {holidays.slice(0, 3).map((holiday) => {
                    const [, month = 1, day = 1] = holiday.date.split('-').map(Number);
                    return (
                      <span key={`${holiday.date}-${holiday.name}`} className="cal-tile" title={holiday.name}>
                        <small>{MONTHS[month - 1]}</small>
                        <b>{day}</b>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          ),
        },
      ];

  return (
    <section className="feat" aria-labelledby="feat-title">
      <div className="wrap">
        <div className="feat-head">
          <div>
            <h2 id="feat-title">What a city page shows</h2>
            <p>Live numbers for Lisbon. {phone ? 'Tap' : 'Pick'} a card to open that part of its page.</p>
          </div>
          {!phone && (
            <Link className="feat-open" to={`/city/${EXAMPLE}`}>
              Open Lisbon
              <Icon name="arrow-right" size={16} />
            </Link>
          )}
        </div>
        <div className={phone ? 'bento hscroll' : 'bento'}>
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              className="bt"
              to={`/city/${EXAMPLE}#${tile.section}`}
              style={cssVars({ '--span': tile.span })}
            >
              <div className="bt-top">
                <span className="tile">
                  <Icon name={tile.icon} size={20} />
                </span>
                <h3>{tile.title}</h3>
              </div>
              <p>{tile.text}</p>
              <div className={`bt-viz${tile.bleed ? ' bleed' : ''}`}>{tile.viz}</div>
              <span className="bt-go">
                {tile.go}
                <Icon name="arrow-right" size={15} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Each month's average low to high, best months in green. */
function MiniClimate({ months }: { months: ClimateMonth[] | undefined }) {
  if (!months || months.length !== 12) return <Loading wide />;
  const lows = months.map((month) => month.temperature_min ?? 0);
  const highs = months.map((month) => month.temperature_max ?? 0);
  const lo = Math.min(...lows);
  const span = Math.max(1, Math.max(...highs) - lo);
  return (
    <>
      <div className="mini-months">
        {months.map((month, index) => (
          <span
            key={index}
            className={month.best ? 'best' : undefined}
            style={cssVars({
              '--lo': (((month.temperature_min ?? lo) - lo) / span) * 100,
              '--hi': (((month.temperature_max ?? lo) - lo) / span) * 100,
            })}
          >
            <i />
          </span>
        ))}
      </div>
      <div className="mini-mlabels">
        {months.map((month, index) => (
          <span key={index} className={month.best ? 'best' : undefined}>
            {MONTH_LETTERS[index]}
          </span>
        ))}
      </div>
    </>
  );
}

/** A speed against a 200 Mbps scale. */
function MiniSpeed({ label, value }: { label: string; value: number }) {
  const share = Math.min(100, value / 2);
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
