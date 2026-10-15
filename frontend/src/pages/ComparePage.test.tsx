import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { City, Essentials, WorkScore } from '../api/types';
import { mockApi, renderWithProviders } from '../test/utils';
import ComparePage from './ComparePage';

function city(id: string, name: string, timezone: string): City {
  return {
    id,
    name,
    state: '',
    state_code: '',
    country: 'Portugal',
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

function score(value: number, internet: number): WorkScore {
  return {
    score: value,
    tier: value >= 80 ? 'excellent' : 'good',
    label: value >= 80 ? 'Excellent' : 'Good',
    counted: 1,
    factors: [
      { key: 'internet', name: 'Internet', weight: 100, score: internet, detail: '' },
      { key: 'places', name: 'Places to work', weight: 0, score: null, detail: '' },
      { key: 'cost', name: 'Cost', weight: 0, score: null, detail: '' },
      { key: 'climate', name: 'Climate', weight: 0, score: null, detail: '' },
    ],
  };
}

const ROUTES = {
  '/api/cities/lisbon--pt': city('lisbon--pt', 'Lisbon', 'Europe/Lisbon'),
  '/api/cities/porto--pt': city('porto--pt', 'Porto', 'Europe/Lisbon'),
  '/api/cities/lisbon--pt/essentials': essentials(380),
  '/api/cities/porto--pt/essentials': essentials(250),
  '/api/cities/lisbon--pt/score': score(84, 90),
  '/api/cities/porto--pt/score': score(71, 70),
};

describe('ComparePage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows each city in a column and marks the clear best in each row', async () => {
    mockApi(ROUTES);
    renderWithProviders(<ComparePage />, { path: '/compare', route: '/compare?cities=lisbon--pt,porto--pt' });

    expect(await screen.findByRole('link', { name: 'Lisbon' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Porto' })).toBeInTheDocument();

    const fast = (await screen.findByText('380 Mbps')).closest('[role="cell"]') as HTMLElement;
    const slow = screen.getByText('250 Mbps').closest('[role="cell"]') as HTMLElement;
    expect(fast).toHaveClass('best');
    expect(within(fast).getByRole('img', { name: 'Best' })).toBeInTheDocument();
    expect(slow).not.toHaveClass('best');

    // The same time zone is a tie, so neither city is marked best for work overlap.
    const overlap = screen.getByRole('rowheader', { name: /Overlap with your 9 to 5/ }).closest('[role="row"]') as HTMLElement;
    expect(overlap.querySelector('.best')).toBeNull();

    expect(await screen.findByText('Remote work score 84 out of 100, Excellent')).toBeInTheDocument();
    expect(screen.getAllByText('$1 = €0.92')).toHaveLength(2);
    expect(screen.getByRole('table', { name: 'Time and internet' })).toBeInTheDocument();
    expect(screen.queryByText('Travel advisory')).toBeNull();
  });

  it('removes a city from the comparison', async () => {
    mockApi(ROUTES);
    renderWithProviders(<ComparePage />, { path: '/compare', route: '/compare?cities=lisbon--pt,porto--pt' });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Porto' }));
    expect(screen.queryByRole('link', { name: 'Porto' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Lisbon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a city' })).toBeInTheDocument();
  });

  it('invites a pick when no cities are chosen', () => {
    renderWithProviders(<ComparePage />, { path: '/compare', route: '/compare' });
    expect(screen.getByRole('heading', { name: 'Pick up to three cities' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a city' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
});
