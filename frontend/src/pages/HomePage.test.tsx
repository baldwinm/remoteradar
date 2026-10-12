import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

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
