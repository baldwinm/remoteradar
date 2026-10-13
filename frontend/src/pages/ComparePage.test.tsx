import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { City, Essentials } from '../api/types';
import { mockApi, renderWithProviders } from '../test/utils';
import ComparePage from './ComparePage';

function city(id: string, name: string, timezone: string): City {
  return {
    id,
    name,
    state: '',
    state_code: '',
    country: 'Somewhere',
    country_code: id.slice(-2),
    lat: 0,
    lng: 0,
    formatted: name,
    timezone,
    currency_code: 'EUR',
    currency_symbol: '€',
    currency_name: 'Euro',
  };
}

function essentials(download: number): Essentials {
  const speed = { download_mbps: download, upload_mbps: 10, latency_ms: 10, tests: 500 };
  return {
    timezone: '',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', usd_rate: 0.92, updated: null },
    holidays: [],
    internet: { fixed: speed, mobile: null, period: 'Q3 2026' },
    partial: false,
  };
}

describe('ComparePage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows each city in a column and marks the best value per row', async () => {
    mockApi({
      '/api/cities/lisbon--pt': city('lisbon--pt', 'Lisbon', 'Europe/Lisbon'),
      '/api/cities/porto--pt': city('porto--pt', 'Porto', 'Europe/Lisbon'),
      '/api/cities/lisbon--pt/essentials': essentials(380),
      '/api/cities/porto--pt/essentials': essentials(250),
    });

    renderWithProviders(<ComparePage />, { path: '/compare', route: '/compare?cities=lisbon--pt,porto--pt' });

    expect(await screen.findByRole('link', { name: 'Lisbon' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Porto' })).toBeInTheDocument();
    const internetRow = (await screen.findByText('380 Mbps down')).closest('tr')!;
    expect(within(internetRow).getByText('380 Mbps down').closest('td')).toHaveClass('best');
    expect(within(internetRow).getByText('250 Mbps down').closest('td')).not.toHaveClass('best');
    expect(screen.queryByText('Travel advisory')).toBeNull();
    expect(screen.getAllByText('$1 = €0.92')).toHaveLength(2);
  });

  it('invites a search when no cities are chosen', () => {
    renderWithProviders(<ComparePage />, { path: '/compare', route: '/compare' });
    expect(screen.getByPlaceholderText('Search for a city to compare')).toBeInTheDocument();
  });
});
