import { useState } from 'react';

import { useWeather } from '../api/queries';
import type { Units } from '../api/types';
import { hourLabel, round, weekdayName } from '../lib/format';
import { weatherIcon } from '../lib/weatherIcons';
import './WeatherWidget.css';

type Tab = 'current' | 'forecast' | 'hourly';

interface Props {
  cityId: string;
  cityName: string;
  units: Units;
  onUnitsChange: (units: Units) => void;
}

export default function WeatherWidget({ cityId, cityName, units, onUnitsChange }: Props) {
  const [tab, setTab] = useState<Tab>('current');
  const { data: weather, isPending, isError, error, isPlaceholderData } = useWeather(cityId, units);

  const header = (
    <div className="weather-header">
      <h3 className="weather-title">Weather in {cityName}</h3>
      <div className="unit-toggle" role="group" aria-label="Temperature units">
        {(['imperial', 'metric'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={units === option ? 'active' : ''}
            aria-pressed={units === option}
            onClick={() => onUnitsChange(option)}
          >
            {option === 'imperial' ? '°F' : '°C'}
          </button>
        ))}
      </div>
    </div>
  );

  if (isPending) {
    return (
      <section className="weather-widget">
        {header}
        <div className="widget-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading weather…</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="weather-widget">
        {header}
        <div className="widget-error">Weather is unavailable right now. {error.message}</div>
      </section>
    );
  }

  const imperial = weather.units === 'imperial';
  const temp = imperial ? '°F' : '°C';
  const speed = imperial ? 'mph' : 'km/h';
  const { current } = weather;

  return (
    <section className={`weather-widget${isPlaceholderData ? ' is-updating' : ''}`} aria-busy={isPlaceholderData}>
      {header}

      <div className="weather-tabs" role="tablist">
        {(['current', 'forecast', 'hourly'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
          >
            {name[0]!.toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'current' && (
        <div className="current-weather">
          <div className="weather-now">
            <div className="weather-icon" role="img" aria-label={current.description}>
              {weatherIcon(current.weather_code, current.is_day)}
            </div>
            <div>
              <div className="weather-temp">
                {round(current.temperature)}
                {temp}
              </div>
              <div className="weather-description">{current.description}</div>
              <div className="weather-feels-like">
                Feels like {round(current.apparent_temperature)}
                {temp}
              </div>
            </div>
          </div>

          <dl className="weather-details">
            <div className="detail-item">
              <dt>Humidity</dt>
              <dd>{current.relative_humidity ?? '–'}%</dd>
            </div>
            <div className="detail-item">
              <dt>Wind</dt>
              <dd>
                {round(current.wind_speed)} {speed}
              </dd>
            </div>
            <div className="detail-item">
              <dt>Precipitation</dt>
              <dd>
                {current.precipitation ?? 0} {imperial ? 'in' : 'mm'}
              </dd>
            </div>
            <div className="detail-item">
              <dt>Cloud cover</dt>
              <dd>{current.cloud_cover ?? 0}%</dd>
            </div>
          </dl>
        </div>
      )}

      {tab === 'forecast' && (
        <div className="forecast-weather">
          {weather.daily.slice(0, 3).map((day) => (
            <div className="forecast-day" key={day.date}>
              <div className="day-name">{weekdayName(day.date)}</div>
              <div className="day-icon" role="img" aria-label={day.description}>
                {weatherIcon(day.weather_code)}
              </div>
              <div className="day-temps">
                <span className="day-high">
                  {round(day.temperature_max)}
                  {temp}
                </span>
                <span className="day-low">
                  {round(day.temperature_min)}
                  {temp}
                </span>
              </div>
              <div className="day-precip">💧 {day.precipitation_probability_max ?? 0}%</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'hourly' && (
        <div className="hourly-weather">
          {weather.hourly.map((hour) => (
            <div className="hourly-item" key={hour.time}>
              <div className="hour-time">{hourLabel(hour.time)}</div>
              <div className="hour-icon" aria-hidden="true">
                {weatherIcon(hour.weather_code, hour.is_day)}
              </div>
              <div className="hour-temp">
                {round(hour.temperature)}
                {temp}
              </div>
              <div className="hour-precip">💧 {hour.precipitation_probability ?? 0}%</div>
            </div>
          ))}
        </div>
      )}

      <div className="weather-footer">
        Powered by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Open-Meteo.com
        </a>
      </div>
    </section>
  );
}
