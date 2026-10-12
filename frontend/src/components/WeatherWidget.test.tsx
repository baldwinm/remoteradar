import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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
    },
  ],
};

describe('WeatherWidget', () => {
  it('shows current conditions, forecast and hourly tabs', async () => {
    mockApi({ '/api/cities/santa-fe--nm--us/weather': WEATHER });
    const user = userEvent.setup();
    renderWithProviders(
      <WeatherWidget cityId="santa-fe--nm--us" cityName="Santa Fe" units="imperial" onUnitsChange={() => {}} />,
    );

    expect(await screen.findByText('68°F')).toBeInTheDocument();
    expect(screen.getByText('Partly cloudy')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument(); // 0% humidity is a value, not "N/A"

    await user.click(screen.getByRole('tab', { name: 'Forecast' }));
    expect(screen.getByText('Monday')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Hourly' }));
    expect(screen.getByText('2 PM')).toBeInTheDocument();
  });

  it('reports unit changes to the page', async () => {
    mockApi({ '/api/cities/x--us/weather': WEATHER });
    const onUnitsChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WeatherWidget cityId="x--us" cityName="X" units="imperial" onUnitsChange={onUnitsChange} />);
    await user.click(screen.getByRole('button', { name: '°C' }));
    expect(onUnitsChange).toHaveBeenCalledWith('metric');
  });

  it('shows a friendly message when the API fails', async () => {
    mockApi({});
    renderWithProviders(<WeatherWidget cityId="x--us" cityName="X" units="metric" onUnitsChange={() => {}} />);
    expect(await screen.findByText(/weather is unavailable/i)).toBeInTheDocument();
  });
});
