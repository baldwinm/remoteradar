import type { KeyboardEvent } from 'react';

import type { ClimateMonth } from '../api/types';
import { seeded, smoothPath } from '../lib/charts';
import { degrees } from '../lib/units';
import Icon, { type IconName } from './Icon';

/* Small SVG charts shared by the home page tiles, the city page and compare. Each is drawn at a fixed
   size in its viewBox and scales to the width of its container. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/** A round axis maximum for the prices: most of them fit, a few pricey outliers sit at the end. */
function priceScale(prices: number[]): { max: number; step: number } {
  const sorted = [...prices].sort((a, b) => a - b);
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 100;
  const step = p95 <= 160 ? 40 : p95 <= 320 ? 100 : p95 <= 700 ? 200 : 500;
  return { max: Math.max(step * 2, Math.ceil((p95 * 1.05) / step) * step), step };
}

interface DotPlotProps {
  /** Nightly prices in US dollars. */
  prices: number[];
  average: number;
  width?: number;
  height?: number;
  /** A price to highlight (the hotel under the pointer). */
  hot?: number | null;
}

/** Each dot is one hotel's nightly price, stacked when they're close; the blue line is the average. */
export function DotPlot({ prices, average, width = 1100, height = 118, hot = null }: DotPlotProps) {
  const left = 8;
  const right = 8;
  const { max, step } = priceScale(prices);
  const bin = max / 30;
  const x = (price: number) => left + (Math.min(price, max) / max) * (width - left - right);
  const stacks = new Map<number, number>();
  // Tall stacks stop at the top of the chart; the extra dots sit on the top one.
  const maxLevel = Math.max(0, Math.floor((height - 34 - 10) / 13));
  const dots = prices.map((price, index) => {
    const slot = Math.round(Math.min(price, max) / bin);
    const level = Math.min(stacks.get(slot) ?? 0, maxLevel);
    stacks.set(slot, level + 1);
    return {
      key: index,
      cx: x(slot * bin),
      cy: height - 34 - level * 13,
      hot: hot !== null && Math.abs(price - hot) < 1,
    };
  });
  const ticks: { at: number; label: string; anchor: 'start' | 'middle' | 'end' }[] = [];
  for (let value = 0; value < max; value += step) {
    // Leave room for the "$max+" label at the right edge.
    if (width - right - x(value) < 56) continue;
    ticks.push({ at: x(value), label: usd(value), anchor: value === 0 ? 'start' : 'middle' });
  }
  ticks.push({ at: width - right, label: `${usd(max)}+`, anchor: 'end' });
  const avgX = x(average);
  const labelLeft = avgX > width - 120;

  return (
    <svg
      className="dots"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Nightly prices of ${prices.length} hotels, average ${usd(average)}`}
    >
      <line className="dp-axis" x1={left} x2={width - right} y1={height - 25} y2={height - 25} />
      {dots.map((dot) => (
        <circle key={dot.key} className={`dp-dot${dot.hot ? ' is-hot' : ''}`} cx={dot.cx.toFixed(1)} cy={dot.cy} r={5.2} />
      ))}
      <line className="dp-avg" x1={avgX.toFixed(1)} x2={avgX.toFixed(1)} y1={8} y2={height - 25} />
      <text className="dp-avg-l" x={(labelLeft ? avgX - 8 : avgX + 8).toFixed(1)} y={18} textAnchor={labelLeft ? 'end' : 'start'}>
        Average {usd(average)}
      </text>
      {ticks.map((tick) => (
        <text key={tick.label} className="dp-t" x={tick.at.toFixed(1)} y={height - 6} textAnchor={tick.anchor}>
          {tick.label}
        </text>
      ))}
    </svg>
  );
}

/* ---------- Next 24 hours ---------- */

export interface HourPoint {
  key: string;
  /** "Now", "3 PM" */
  label: string;
  /** In the visitor's units. */
  temp: number;
  icon: IconName;
  /** Chance of rain, in percent. */
  rain: number;
  isDay: boolean;
}

interface HourlyProps {
  hours: HourPoint[];
  /** Space between hours. */
  colW?: number;
  height?: number;
  /** Label every nth hour. */
  every?: number;
  /** Drawn at its real size (phones scroll it sideways) instead of scaling to fit. */
  fixed?: boolean;
}

/** Temperature, chance of rain and night shading for the next 24 hours. */
export function HourlyChart({ hours, colW = 30, height = 196, every = 3, fixed = false }: HourlyProps) {
  const first = hours[0];
  if (!first || hours.length < 2) return null;
  const padX = 18;
  const width = padX * 2 + colW * (hours.length - 1);
  const top = 46;
  // Under the plot, top to bottom: icons, the chance of rain in its own row, then the hour.
  const bottom = height - 84;
  const temps = hours.map((hour) => hour.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const y = (temp: number) => bottom - ((temp - lo) / Math.max(1, hi - lo)) * (bottom - top);
  const x = (index: number) => padX + index * colW;
  const line = smoothPath(hours.map((hour, index) => [x(index), y(hour.temp)]));
  const area = `${line} L${x(hours.length - 1)} ${bottom + 8} L${x(0)} ${bottom + 8} Z`;

  return (
    <svg
      className="hourly-chart"
      viewBox={`0 0 ${width} ${height}`}
      width={fixed ? width : undefined}
      height={fixed ? height : undefined}
      role="img"
      aria-label={`Temperature for the next ${hours.length} hours, from ${degrees(lo)} to ${degrees(hi)}`}
    >
      <defs>
        <linearGradient id="hc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="hc-stop-top" />
          <stop offset="1" className="hc-stop-bottom" />
        </linearGradient>
      </defs>
      {hours.map((hour, index) =>
        hour.isDay ? null : (
          <rect
            key={`night-${hour.key}`}
            className="hc-night"
            x={(x(index) - colW / 2).toFixed(1)}
            y={0}
            width={colW + 0.5}
            height={height - 26}
          />
        ),
      )}
      <line className="hc-grid" x1={0} x2={width} y1={bottom + 8} y2={bottom + 8} />
      <path className="hc-area" d={area} />
      <path className="hc-line" d={line} />
      {hours.map((hour, index) => {
        const show = index % every === 0;
        const now = index === 0;
        const rainHeight = (hour.rain / 100) * 22;
        return (
          <g key={hour.key}>
            {show && (
              <>
                <text className="hc-t" x={x(index)} y={(y(hour.temp) - 12).toFixed(1)} textAnchor="middle">
                  {degrees(hour.temp)}
                </text>
                <g className="hc-ic">
                  <Icon name={hour.icon} size={18} x={x(index) - 9} y={height - 70} />
                </g>
                <text className={`hc-h${now ? ' now' : ''}`} x={x(index)} y={height - 8} textAnchor="middle">
                  {hour.label}
                </text>
                {!now && <circle className="hc-dot" cx={x(index)} cy={y(hour.temp).toFixed(1)} r={3.5} />}
              </>
            )}
            {hour.rain >= 20 && (
              <>
                <rect
                  className="hc-rain"
                  x={x(index) - 5}
                  y={(bottom + 6 - rainHeight).toFixed(1)}
                  width={10}
                  height={rainHeight.toFixed(1)}
                  rx={2}
                />
                {show && (
                  <text className="hc-p" x={x(index)} y={height - 30} textAnchor="middle">
                    {Math.round(hour.rain)}%
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
      <circle className="hc-now" cx={x(0)} cy={y(first.temp).toFixed(1)} r={6} />
    </svg>
  );
}

/* ---------- Climate by month ---------- */

interface ClimateProps {
  months: ClimateMonth[];
  width: number;
  height: number;
  /** 0 to 11 */
  selected: number;
  nowMonth: number | null;
  onSelect: (month: number) => void;
}

/** A month's numbers, read out by the chart and shown under the best months. */
export function climateMonthText(month: ClimateMonth): string {
  const name = MONTHS_LONG[month.month - 1] ?? '';
  const rainy = month.rainy_days === null ? '' : `, ${Math.round(month.rainy_days)} rainy days`;
  return `${name}: ${degrees(month.temperature_min)} to ${degrees(month.temperature_max)}${rainy}`;
}

/** Each month's average low to high as a bar, rainy days underneath, best months in green. */
export function ClimateChart({ months, width, height, selected, nowMonth, onSelect }: ClimateProps) {
  const temps = months.flatMap((month) => [month.temperature_min, month.temperature_max]).filter((t) => t !== null);
  if (temps.length === 0) return null;
  const left = 34;
  const top = 28;
  const plotBottom = height - 58;
  const col = (width - left) / 12;
  const barW = Math.min(22, col * 0.46);
  const narrow = col < 34;
  const pill = Math.min(34, col - 2);
  const min = Math.floor(Math.min(...temps) / 10) * 10;
  const max = Math.max(min + 10, Math.ceil(Math.max(...temps) / 10) * 10);
  const y = (temp: number) => plotBottom - ((temp - min) / (max - min)) * (plotBottom - top);
  const x = (index: number) => left + col * index + col / 2;
  const grid: number[] = [];
  for (let temp = min; temp <= max; temp += 10) grid.push(temp);
  const current = months[selected];

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
    let next: number | null = null;
    if (event.key in moves) next = (selected + (moves[event.key] ?? 0) + 12) % 12;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 11;
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
  }

  return (
    <svg
      className="clim"
      viewBox={`0 0 ${width} ${height}`}
      tabIndex={0}
      role="slider"
      aria-label="Average monthly temperatures and rainy days. Use the arrow keys to read each month."
      aria-valuemin={1}
      aria-valuemax={12}
      aria-valuenow={selected + 1}
      aria-valuetext={current ? climateMonthText(current) : undefined}
      onKeyDown={onKey}
    >
      {months.map((month, index) =>
        month.best ? (
          <rect
            key={`band-${month.month}`}
            className="cl-band"
            x={(x(index) - col / 2 + 2).toFixed(1)}
            y={4}
            width={(col - 4).toFixed(1)}
            height={height - 8}
            rx={8}
          />
        ) : null,
      )}
      {grid.map((temp) => (
        <g key={`grid-${temp}`}>
          <line className="cl-grid" x1={left} x2={width} y1={y(temp).toFixed(1)} y2={y(temp).toFixed(1)} />
          <text className="cl-axis" x={left - 8} y={(y(temp) + 4).toFixed(1)} textAnchor="end">
            {temp}°
          </text>
        </g>
      ))}
      {months.map((month, index) => {
        const lo = month.temperature_min;
        const hi = month.temperature_max;
        const best = month.best ? ' best' : '';
        return (
          <g key={month.month}>
            {selected === index && (
              <rect
                className="cl-sel"
                x={(x(index) - col / 2 + 2).toFixed(1)}
                y={4}
                width={(col - 4).toFixed(1)}
                height={height - 8}
                rx={8}
              />
            )}
            {lo !== null && hi !== null && (
              <>
                <rect
                  className={`cl-bar${best}`}
                  x={(x(index) - barW / 2).toFixed(1)}
                  y={y(hi).toFixed(1)}
                  width={barW.toFixed(1)}
                  height={Math.max(4, y(lo) - y(hi)).toFixed(1)}
                  rx={(barW / 2).toFixed(1)}
                />
                <text className="cl-val" x={x(index).toFixed(1)} y={(y(hi) - 7).toFixed(1)} textAnchor="middle">
                  {degrees(hi)}
                </text>
              </>
            )}
            <text className={`cl-m${best}`} x={x(index).toFixed(1)} y={plotBottom + 22} textAnchor="middle">
              {/* Single letters when the columns are too narrow for "Mar", as on phones. */}
              {narrow ? MONTHS[index]?.[0] : MONTHS[index]}
            </text>
            {month.rainy_days !== null && (
              <text className="cl-rain" x={x(index).toFixed(1)} y={plotBottom + 42} textAnchor="middle">
                {Math.round(month.rainy_days)}d
              </text>
            )}
            {nowMonth === index && (
              <g className="cl-now">
                <rect x={(x(index) - pill / 2).toFixed(1)} y={height - 14} width={pill.toFixed(1)} height={14} rx={7} />
                <text x={x(index).toFixed(1)} y={height - 3.5} textAnchor="middle">
                  Now
                </text>
              </g>
            )}
            <rect
              className="cl-hit"
              x={(x(index) - col / 2).toFixed(1)}
              y={0}
              width={col.toFixed(1)}
              height={height}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') onSelect(index);
              }}
              onClick={() => onSelect(index)}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Hotel photo placeholder ---------- */

/** A few soft building shapes, for hotels without a photo. Seeded, so each hotel keeps its own. */
export function PhotoArt({ seed }: { seed: number }) {
  const random = seeded(seed);
  const shapes: { key: string; x: number; y: number; w: number; h: number; o: number; rx: number }[] = [];
  let x = -10;
  while (x < 330) {
    const w = 36 + random() * 46;
    const h = 60 + random() * 90;
    shapes.push({ key: `b${shapes.length}`, x, y: 200 - h, w, h, o: 0.18 + random() * 0.22, rx: 3 });
    for (let wy = 200 - h + 12; wy < 186; wy += 16) {
      for (let wx = x + 7; wx < x + w - 8; wx += 12) {
        shapes.push({ key: `w${shapes.length}`, x: wx, y: wy, w: 5, h: 7, o: 0.32, rx: 1 });
      }
    }
    x += w + 4;
  }
  return (
    <svg className="ph-art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {shapes.map((shape) => (
        <rect
          key={shape.key}
          x={shape.x.toFixed(0)}
          y={shape.y.toFixed(0)}
          width={shape.w.toFixed(0)}
          height={shape.h.toFixed(0)}
          rx={shape.rx}
          fill="#ffffff"
          fillOpacity={shape.o.toFixed(2)}
        />
      ))}
    </svg>
  );
}
