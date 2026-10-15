import { useWeather } from '../../api/queries';
import type { City, DailyForecast, Units, Weather } from '../../api/types';
import { useNow } from '../../lib/clock';
import { hourLabel, shortWeekday } from '../../lib/format';
import { useIsPhone } from '../../lib/layout';
import { isoMinutes } from '../../lib/sky';
import { fmtClock, zoneDate } from '../../lib/time';
import { degrees } from '../../lib/units';
import { weatherIcon } from '../../lib/weatherIcons';
import { type HourPoint, HourlyChart } from '../charts';
import Icon from '../Icon';
import UnitsToggle from '../UnitsToggle';
import { SecHead, cssVars } from '../ui';
import { DAYS_LONG, rainLabel, windLabel } from './common';
import { CardSkeleton, SectionError } from './states';

interface Props {
  city: City;
  dataId: string;
  units: Units;
  onUnits: (units: Units) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "Now", then the next 23 hours of the forecast. */
function hourPoints(weather: Weather, when: Date): HourPoint[] {
  const local = zoneDate(weather.timezone, when);
  const thisHour = `${local.year}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}`;
  const upcoming = weather.hourly.filter((hour) => hour.time.slice(0, 13) >= thisHour && hour.temperature !== null);
  const current = weather.current;
  const first = upcoming[0];
  const nowTemp = current.temperature ?? first?.temperature ?? null;
  if (nowTemp === null) return [];
  const points: HourPoint[] = [
    {
      key: 'now',
      label: 'Now',
      temp: nowTemp,
      icon: weatherIcon(current.weather_code, current.is_day),
      rain: first?.time.slice(0, 13) === thisHour ? (first.precipitation_probability ?? 0) : 0,
      isDay: current.is_day,
    },
  ];
  for (const hour of upcoming) {
    if (hour.time.slice(0, 13) === thisHour || points.length >= 24) continue;
    points.push({
      key: hour.time,
      label: hourLabel(hour.time),
      temp: hour.temperature ?? nowTemp,
      icon: weatherIcon(hour.weather_code, hour.is_day),
      rain: hour.precipitation_probability ?? 0,
      isDay: hour.is_day,
    });
  }
  return points;
}

const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const WET = (code: number | null) => code !== null && code >= 51;

/** "Clear sky now, rain likely Friday" */
function weatherTitle(weather: Weather, when: Date): string {
  const now = `${weather.current.description} now`;
  if (WET(weather.current.weather_code)) return now;
  const index = weather.daily.findIndex((day) => (day.precipitation_probability_max ?? 0) >= 50);
  const day = weather.daily[index];
  if (!day) return `${now}, no rain in the forecast`;
  const what = SNOW.has(day.weather_code ?? -1) ? 'snow' : 'rain';
  if (index === 0) return `${now}, ${what} likely later today`;
  if (index === 1) return `${now}, ${what} likely tomorrow`;
  const today = zoneDate(weather.timezone, when).weekday;
  return `${now}, ${what} likely ${DAYS_LONG[(today + index) % 7]}`;
}

function daylight(seconds: number | null): string {
  if (seconds === null) return '–';
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function clock(iso: string | null): string {
  const minutes = isoMinutes(iso);
  return minutes === null ? '–' : fmtClock(minutes);
}

export default function WeatherSection({ city, dataId, units, onUnits }: Props) {
  const phone = useIsPhone();
  const now = useNow();
  const weather = useWeather(dataId, units);
  const data = weather.data;
  const when = new Date(now);
  const toggle = <UnitsToggle units={units} onChange={onUnits} />;

  let body;
  if (weather.isPending) {
    body = (
      <div className={phone ? 'stack' : 'wx-grid'}>
        <CardSkeleton lines={6} tall />
        <CardSkeleton lines={7} tall />
      </div>
    );
  } else if (weather.isError && !data) {
    body = <SectionError title="The forecast didn't load" error={weather.error} onRetry={() => void weather.refetch()} />;
  } else if (data) {
    const current = data.current;
    const today = data.daily[0];
    const hours = hourPoints(data, when);
    const stats = (
      <div className="wx-stats">
        <div className="wx-stat">
          <span className="label">
            <Icon name="droplet" size={14} />
            Humidity
          </span>
          <b>{current.relative_humidity === null ? '–' : `${Math.round(current.relative_humidity)}%`}</b>
        </div>
        <div className="wx-stat">
          <span className="label">
            <Icon name="wind" size={14} />
            Wind
          </span>
          <b>{windLabel(current.wind_speed, data.units)}</b>
        </div>
        <div className="wx-stat">
          <span className="label">
            <Icon name="cloud" size={14} />
            Clouds
          </span>
          <b>{current.cloud_cover === null ? '–' : `${Math.round(current.cloud_cover)}%`}</b>
        </div>
        <div className="wx-stat">
          <span className="label">
            <Icon name="umbrella" size={14} />
            Rain
          </span>
          <b>{rainLabel(current.precipitation, data.units)}</b>
        </div>
      </div>
    );
    const nowBlock = (
      <>
        <div className="wx-now">
          <Icon name={weatherIcon(current.weather_code, current.is_day)} size={phone ? 46 : 54} />
          <div className="wx-temp">{degrees(current.temperature)}</div>
          <div>
            <div className="wx-desc">{current.description}</div>
            <div className="wx-feels">Feels like {degrees(current.apparent_temperature)}</div>
          </div>
          {!phone && stats}
        </div>
        {phone && stats}
      </>
    );
    const chart = phone ? (
      <div className="hourly-scroll" tabIndex={0} aria-label="Next 24 hours, scrolls sideways">
        <HourlyChart hours={hours} colW={50} height={188} every={1} fixed />
      </div>
    ) : (
      <HourlyChart hours={hours} colW={31.5} height={196} every={3} />
    );
    const sun = today && (
      <div className="sunrow">
        <span>
          <Icon name="sunrise" size={18} />
          Sunrise <b>{clock(today.sunrise)}</b>
        </span>
        <span>
          <Icon name="sunset" size={18} />
          Sunset <b>{clock(today.sunset)}</b>
        </span>
        <span>
          <Icon name="sun" size={18} />
          Daylight <b>{daylight(today.daylight_seconds)}</b>
        </span>
      </div>
    );
    body = (
      <>
        <div className={`${phone ? 'stack' : 'wx-grid'}${weather.isPlaceholderData ? ' is-updating' : ''}`}>
          <div className="card">
            <div className="card-b">
              {nowBlock}
              {chart}
              {sun}
            </div>
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Next 7 days</h3>
              {phone && toggle}
            </div>
            <div className="card-b days-b">
              <Week days={data.daily} nowTemp={current.temperature} />
            </div>
          </div>
        </div>
        <p className="pl-foot">
          Forecast from{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo.com
          </a>
          , for {city.name}&apos;s local time.
        </p>
      </>
    );
  }

  return (
    <section className="sec" data-sec="weather" id="weather" aria-labelledby="weather-title">
      <div className="wrap">
        <SecHead
          id="weather-title"
          icon={<Icon name="cloud-sun" size={16} />}
          kicker="Weather"
          title={data ? weatherTitle(data, when) : `Weather in ${city.name}`}
          tools={!phone && toggle}
        />
        {body}
      </div>
    </section>
  );
}

/** Seven days, each a bar from its low to its high on one scale for the week. */
function Week({ days, nowTemp }: { days: DailyForecast[]; nowTemp: number | null }) {
  const lows = days.map((day) => day.temperature_min).filter((t) => t !== null);
  const highs = days.map((day) => day.temperature_max).filter((t) => t !== null);
  if (lows.length === 0 || highs.length === 0) return <p className="card-empty">No forecast for the week right now.</p>;
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  const span = Math.max(1, hi - lo);
  return (
    <div className="days7">
      {days.map((day, index) => {
        const min = day.temperature_min ?? lo;
        const max = day.temperature_max ?? hi;
        const rain = Math.round(day.precipitation_probability_max ?? 0);
        const now = index === 0 && nowTemp !== null ? Math.min(100, Math.max(0, ((nowTemp - lo) / span) * 100)) : null;
        return (
          <div className="day7" key={day.date}>
            <span className="d-name">{index === 0 ? 'Today' : shortWeekday(day.date)}</span>
            <Icon name={weatherIcon(day.weather_code, true)} size={22} />
            <span className={`d-p${rain < 20 ? ' dry' : ''}`}>
              <span className="sr-only">Chance of rain </span>
              {rain}%
            </span>
            <span className="d-lo">
              <span className="sr-only">Low </span>
              {degrees(day.temperature_min)}
            </span>
            <span
              className="range"
              style={cssVars({ '--a': `${(((min - lo) / span) * 100).toFixed(1)}%`, '--b': `${(((hi - max) / span) * 100).toFixed(1)}%` })}
              aria-hidden="true"
            >
              <i />
              {now !== null && <em style={cssVars({ '--n': `${now.toFixed(1)}%` })} />}
            </span>
            <span className="d-hi">
              <span className="sr-only">High </span>
              {degrees(day.temperature_max)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
