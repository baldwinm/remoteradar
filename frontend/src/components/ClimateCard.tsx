import { useClimate } from '../api/queries';
import type { Climate, Units } from '../api/types';
import { round } from '../lib/format';
import './ClimateCard.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function bestMonths(climate: Climate | undefined): string {
  const best = climate?.months.filter((month) => month.best).map((month) => MONTHS[month.month - 1]) ?? [];
  return best.length ? best.join(', ') : '–';
}

interface Props {
  cityId: string;
  units: Units;
}

export default function ClimateCard({ cityId, units }: Props) {
  const { data, isPending, isError, error, isPlaceholderData } = useClimate(cityId, units);

  return (
    <section
      className={`card climate${isPlaceholderData ? ' is-updating' : ''}`}
      id="climate"
      aria-labelledby="climate-title"
    >
      <div className="card-head">
        <h2 id="climate-title">Best time to go</h2>
        {data && <span className="card-meta">Averages {data.years.replace('-', ' to ')}</span>}
      </div>
      {isPending ? (
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading climate history…</p>
        </div>
      ) : isError ? (
        <div className="widget-error">Climate averages are unavailable right now. {error.message}</div>
      ) : (
        <>
          <p className="climate-best">
            Best months: <b>{bestMonths(data)}</b>
          </p>
          <ClimateChart climate={data} />
          <p className="climate-note">
            Bars run from the average low to the average high. The row under each month is rainy days. Green months
            are the mildest with the least rain.
          </p>
        </>
      )}
      <div className="card-foot">
        <span>
          Historical data from{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo.com
          </a>
        </span>
      </div>
    </section>
  );
}

const WIDTH = 540;
const HEIGHT = 196;
const LEFT = 36;
const TOP = 12;
const PLOT_BOTTOM = 150;
const COLUMN = (WIDTH - LEFT) / 12;
const BAR = 16;

function ClimateChart({ climate }: { climate: Climate }) {
  const temps = climate.months.flatMap((m) => [m.temperature_min, m.temperature_max]).filter((t) => t !== null);
  if (temps.length === 0) return <p className="widget-empty">No climate history for this location.</p>;

  // Round the scale out to a multiple of 10 so the gridlines land on round numbers.
  const min = Math.floor(Math.min(...temps) / 10) * 10;
  const max = Math.ceil(Math.max(...temps) / 10) * 10 || min + 10;
  const y = (t: number) => PLOT_BOTTOM - ((t - min) / (max - min)) * (PLOT_BOTTOM - TOP);
  const ticks: number[] = [];
  for (let t = min; t <= max; t += 10) ticks.push(t);
  const degree = climate.units === 'imperial' ? '°F' : '°C';
  const x = (index: number) => LEFT + COLUMN * index + COLUMN / 2;

  const summary = climate.months
    .map(
      (m) =>
        `${MONTHS[m.month - 1]}: ${round(m.temperature_min)} to ${round(m.temperature_max)}${degree}, ${round(
          m.rainy_days,
        )} rainy days${m.best ? ' (best)' : ''}`,
    )
    .join('; ');

  return (
    <div className="climate-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary}>
        {climate.months.map((m, index) =>
          m.best ? (
            <rect
              key={`band-${m.month}`}
              className="climate-band"
              x={x(index) - COLUMN / 2 + 2}
              y={TOP - 6}
              width={COLUMN - 4}
              height={HEIGHT - TOP}
              rx={5}
            />
          ) : null,
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line className="climate-grid" x1={LEFT} x2={WIDTH} y1={y(t)} y2={y(t)} />
            <text className="climate-axis" x={LEFT - 6} y={y(t) + 3} textAnchor="end">
              {t}°
            </text>
          </g>
        ))}
        {climate.months.map((m, index) => {
          const low = m.temperature_min;
          const high = m.temperature_max;
          return (
            <g key={m.month}>
              {low !== null && high !== null && (
                <rect
                  className="climate-bar"
                  x={x(index) - BAR / 2}
                  y={y(high)}
                  width={BAR}
                  height={Math.max(2, y(low) - y(high))}
                  rx={4}
                />
              )}
              <text className={m.best ? 'climate-month best' : 'climate-month'} x={x(index)} y={PLOT_BOTTOM + 20}>
                {MONTHS[m.month - 1]}
              </text>
              <text className="climate-axis" x={x(index)} y={PLOT_BOTTOM + 36} textAnchor="middle">
                {m.rainy_days === null ? '–' : `${Math.round(m.rainy_days)}d`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
