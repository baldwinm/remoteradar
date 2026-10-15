import { screen, within } from '@testing-library/react';
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
    mockApi({});
    renderWithProviders(<HomePage />);
    expect(screen.queryByRole('heading', { name: 'Your cities' })).not.toBeInTheDocument();
    expect(screen.queryByText('Recently viewed')).not.toBeInTheDocument();
  });

  it('lists saved cities and recent visits, and lets you remove a saved one', async () => {
    mockApi({});
    act(() => {
      toggleSaved(LISBON);
      recordVisit(PORTO);
      recordVisit(LISBON);
    });
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    const section = screen.getByRole('region', { name: 'Your cities' });
    expect(within(section).getByRole('link', { name: /^Lisbon.*Portugal/ })).toHaveAttribute('href', '/city/lisbon--pt');
    // Lisbon is already saved, so recent visits show only Porto.
    expect(within(section).getByRole('link', { name: 'Porto' })).toHaveAttribute('href', '/city/porto--pt');
    expect(within(section).queryByRole('link', { name: 'Lisbon' })).not.toBeInTheDocument();
    // Saved cities stay on this device without a note saying so under the cards.
    expect(screen.queryByText(/Saved on this computer only/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Lisbon from your cities' }));
    expect(screen.queryByRole('heading', { name: 'Your cities' })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('rr:saved-cities')!)).toHaveLength(0);
  });

  it('has no "Private by design" section', () => {
    mockApi({});
    renderWithProviders(<HomePage />);
    expect(screen.queryByText(/Private by design/i)).not.toBeInTheDocument();
  });
});

describe('HomePage popular cities', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the built-in cities until there is enough data', () => {
    mockApi({ '/api/popular': { scope: 'none', country_code: '', cities: [] } });
    renderWithProviders(<HomePage />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
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
    expect(await screen.findByText('Popular on Remote Radar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bali' })).toHaveAttribute('href', '/city/bali--id');
  });
});
