import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { City, Essentials, WorkScore } from '../api/types';
import { mockApi, renderWithProviders } from '../test/utils';
import CityPage from './CityPage';

const LISBON: City = {
  id: 'lisbon--lisbon--pt',
  name: 'Lisbon',
  state: 'Lisbon',
  state_code: '',
  country: 'Portugal',
  country_code: 'pt',
  lat: 38.72,
  lng: -9.14,
  formatted: 'Lisbon, Portugal',
  timezone: 'Europe/Lisbon',
  currency_code: 'EUR',
  currency_symbol: '€',
  currency_name: 'Euro',
};

const SCORE: WorkScore = {
  score: 83,
  tier: 'excellent',
  label: 'Excellent',
  counted: 4,
  factors: [
    { key: 'internet', name: 'Internet', weight: 29, score: 90, detail: '164 Mbps average download' },
    { key: 'places', name: 'Places to work', weight: 29, score: 94, detail: '14 coworking spaces' },
    { key: 'cost', name: 'Cost', weight: 24, score: 57, detail: '$142 a night' },
    { key: 'climate', name: 'Climate', weight: 18, score: 90, detail: 'Mild most of the year' },
  ],
};

const ESSENTIALS: Essentials = {
  timezone: 'Europe/Lisbon',
  currency: { code: 'EUR', symbol: '€', name: 'Euro', usd_rate: 0.86, updated: null },
  holidays: [],
  internet: { fixed: { download_mbps: 164, upload_mbps: 90, latency_ms: 9, tests: 4000 }, mobile: null, period: 'Q3 2026' },
  partial: false,
};

describe('CityPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('shows the city with its score, and keeps going when a section fails to load', async () => {
    // Weather, climate, hotels and places answer with errors here.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockApi({
      '/api/cities/lisbon--lisbon--pt': LISBON,
      '/api/cities/lisbon--lisbon--pt/score': SCORE,
      '/api/cities/lisbon--lisbon--pt/essentials': ESSENTIALS,
    });
    renderWithProviders(<CityPage />, { path: '/city/:cityId', route: '/city/lisbon--lisbon--pt' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeInTheDocument();
    expect(await screen.findAllByText('Excellent')).not.toHaveLength(0);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(await screen.findByText("Hotel prices didn't load")).toBeInTheDocument();
    expect(document.title).toBe('Lisbon - Remote Radar');
  });

  it('says so when the city does not exist', async () => {
    mockApi({});
    renderWithProviders(<CityPage />, { path: '/city/:cityId', route: '/city/atlantis--xx' });
    expect(await screen.findByRole('heading', { name: 'City not found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search cities' })).toBeInTheDocument();
  });
});
