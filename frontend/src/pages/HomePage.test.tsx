import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordVisit, toggleSaved } from '../lib/savedCities';
import { mockApi, renderWithProviders } from '../test/utils';
import HomePage from './HomePage';

const LISBON = { id: 'lisbon--pt', name: 'Lisbon', country: 'Portugal', timezone: 'Europe/Lisbon' };
const PORTO = { id: 'porto--pt', name: 'Porto', country: 'Portugal' };

describe('HomePage saved and recent cities', () => {
  afterEach(() => window.localStorage.clear());

  it('hides the section until there is something to show', () => {
    renderWithProviders(<HomePage />);
    expect(screen.queryByText('Your saved cities')).not.toBeInTheDocument();
  });

  it('lists saved cities, recent visits, and lets you remove a saved one', async () => {
    mockApi({});
    act(() => {
      toggleSaved(LISBON);
      recordVisit(PORTO);
      recordVisit(LISBON);
    });
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    expect(screen.getByText('Your saved cities')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Lisbon.*Portugal/ })).toHaveAttribute('href', '/city/lisbon--pt');
    // Lisbon is already saved, so recent shows only Porto.
    expect(screen.getByRole('link', { name: 'Porto' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('rr:saved-cities')!)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Remove Lisbon from saved cities' }));
    expect(screen.queryByText('Your saved cities')).not.toBeInTheDocument();
  });
});

describe('HomePage popular cities', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the built-in cities until there is enough data', async () => {
    mockApi({ '/api/popular': { scope: 'none', country_code: '', cities: [] } });
    renderWithProviders(<HomePage />);
    expect(screen.getByText('Popular:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tbilisi' })).toHaveAttribute('href', '/city/tbilisi--ge');
  });

  it("shows the visitor's country list when there is one", async () => {
    mockApi({
      '/api/popular': {
        scope: 'country',
        country_code: 'US',
        cities: [
          { id: 'denver--co--us', name: 'Denver' },
          { id: 'lisbon--lisbon--pt', name: 'Lisbon' },
        ],
      },
    });
    renderWithProviders(<HomePage />);
    expect(await screen.findByRole('link', { name: 'Denver' })).toHaveAttribute('href', '/city/denver--co--us');
    expect(screen.getByText('the United States')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tbilisi' })).not.toBeInTheDocument();
  });

  it('falls back to the site-wide list', async () => {
    mockApi({ '/api/popular': { scope: 'site', country_code: '', cities: [{ id: 'bali--id', name: 'Bali' }] } });
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('Popular on Remote Radar:')).toBeInTheDocument();
  });
});
