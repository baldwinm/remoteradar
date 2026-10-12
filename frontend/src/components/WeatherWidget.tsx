import { useWeather } from '../api/queries';
import type { Units } from '../api/types';
import { hourLabel, round, shortWeekday } from '../lib/format';
import { isSunny, weatherIcon } from '../lib/weatherIcons';
import Icon from './Icon';
import './WeatherWidget.css';

const FORECAST_DAYS = 3;

interface Props {
  cityId: string;
  units: Units;
}

export default function WeatherWidget({ cityId, units }: Props) {
  const { data: weather, isPending, isError, error, isPlaceholderData } = useWeather(cityId, units);

  const head = (
    <div className="card-head">
      <h2 id="weather-title">Weather</h2>
      <span className="card-meta">Now, next hours and 3 days</span>
    </div>
  );

  if (isPending) {
    return (
      <section className="card weather" id="weather" aria-labelledby="weather-title">
        {head}
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading weather…</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card weather" id="weather" aria-labelledby="weather-title">
        {head}
        <div className="widget-error">Weather is unavailable right now. {error.message}</div>
      </section>
    );
  }

  const imperial = weather.units === 'imperial';
  const temp = imperial ? '°F' : '°C';
  const speed = imperial ? 'mph' : 'km/h';
  const { current } = weather;
  const nowIcon = weatherIcon(current.weather_code, current.is_day);

  const days = weather.daily.slice(0, FORECAST_DAYS);
  const lows = days.map((day) => day.temperature_min).filter((value): value is number => value !== null);
  const highs = days.map((day) => day.temperature_max).filter((value): value is number => value !== null);
  const scaleMin = Math.min(...lows, ...highs);
  const scaleMax = Math.max(...lows, ...highs);
  const span = scaleMax - scaleMin || 1;
  const position = (value: number) => ((value - scaleMin) / span) * 100;

  return (
    <section
      className={`card weather${isPlaceholderData ? ' is-updating' : ''}`}
      id="weather"
      aria-labelledby="weather-title"
      aria-busy={isPlaceholderData}
    >
      {head}

      <div className="weather-now">
        <Icon
          name={nowIcon}
          size={56}
          label={current.description}
          className={isSunny(nowIcon) ? 'weather-icon sunny' : 'weather-icon'}
        />
        <div className="weather-temp">
          {round(current.temperature)}
          {temp}
        </div>
        <div>
          <div className="weather-description">{current.description}</div>
          <div className="weather-feels-like">
            Feels like {round(current.apparent_temperature)}
            {temp}
          </div>
        </div>
      </div>

      <dl className="weather-details">
        <div>
          <dt>Humidity</dt>
          <dd>{current.relative_humidity ?? '–'}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {round(current.wind_speed)} {speed}
          </dd>
        </div>
        <div>
          <dt>Rain</dt>
          <dd>
            {current.precipitation ?? 0} {imperial ? 'in' : 'mm'}
          </dd>
        </div>
        <div>
          <dt>Cloud</dt>
          <dd>{current.cloud_cover ?? 0}%</dd>
        </div>
      </dl>

      <ol className="hourly" aria-label="Next hours">
        {weather.hourly.map((hour) => {
          const icon = weatherIcon(hour.weather_code, hour.is_day);
          return (
            <li className="hour" key={hour.time}>
              <span className="hour-time">{hourLabel(hour.time)}</span>
              <Icon name={icon} className={isSunny(icon) ? 'sunny' : undefined} />
              <span className="hour-temp">{round(hour.temperature)}°</span>
              <span className="hour-precip" title="Chance of rain">
                {hour.precipitation_probability ?? 0}%
              </span>
            </li>
          );
        })}
      </ol>

      <ol className="days" aria-label="3-day forecast">
        {days.map((day, index) => {
          const icon = weatherIcon(day.weather_code);
          const low = day.temperature_min;
          const high = day.temperature_max;
          return (
            <li className="day" key={day.date}>
              <span className="day-name">{index === 0 ? 'Today' : shortWeekday(day.date)}</span>
              <Icon name={icon} label={day.description} className={isSunny(icon) ? 'sunny' : undefined} />
              <span className="day-precip" title="Chance of rain">
                {day.precipitation_probability_max ?? 0}%
              </span>
              <span className="day-range">
                <span className="day-low">{round(low)}°</span>
                <span className="range-bar" aria-hidden="true">
                  {low !== null && high !== null && (
                    <i style={{ left: `${position(low)}%`, right: `${100 - position(high)}%` }} />
                  )}
                </span>
                <span className="day-high">{round(high)}°</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="card-foot">
        <span>
          Powered by{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo.com
          </a>
        </span>
      </div>
    </section>
  );
}
