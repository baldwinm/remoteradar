import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Weather } from '../api/types';
import { mockApi, renderWithProviders } from '../test/utils';
import WeatherWidget from './WeatherWidget';

const WEATHER: Weather = {
  units: 'imperial',
  timezone: 'America/Denver',
  current: {
    time: '2026-10-12T14:15',
    temperature: 68.4,
    apparent_temperature: 66,
    relative_humidity: 0,
    precipitation: 0,
    cloud_cover: 40,
    wind_speed: 8.1,
    wind_direction: 220,
    weather_code: 2,
    description: 'Partly cloudy',
    is_day: true,
  },
  hourly: [{ time: '2026-10-12T14:00', temperature: 68, precipitation_probability: 10, weather_code: 2, is_day: true }],
  daily: [
    {
      date: '2026-10-12',
      temperature_max: 70,
      temperature_min: 45,
      precipitation_probability_max: 10,
      weather_code: 2,
      description: 'Partly cloudy',
      sunrise: null,
      sunset: null,
      daylight_seconds: null,
    },
    {
      date: '2026-10-13',
      temperature_max: 72,
      temperature_min: 47,
      precipitation_probability_max: 30,
      weather_code: 61,
      description: 'Light rain',
      sunrise: null,
      sunset: null,
      daylight_seconds: null,
    },
  ],
};

describe('WeatherWidget', () => {
  it('shows current conditions, the next hours and the 3-day forecast together', async () => {
    mockApi({ '/api/cities/santa-fe--nm--us/weather': WEATHER });
    renderWithProviders(<WeatherWidget cityId="santa-fe--nm--us" units="imperial" />);

    expect(await screen.findByText('68°F')).toBeInTheDocument();
    expect(screen.getByText('Partly cloudy')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument(); // 0% humidity is a value, not "N/A"
    expect(screen.getByText('2 PM')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
  });

  it('shows a friendly message when the API fails', async () => {
    mockApi({});
    renderWithProviders(<WeatherWidget cityId="x--us" units="metric" />);
    expect(await screen.findByText(/weather is unavailable/i)).toBeInTheDocument();
  });
});
