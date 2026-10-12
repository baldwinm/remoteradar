import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockApi, renderWithProviders } from '../test/utils';
import SearchBar from './SearchBar';

const SANTA_FE = {
  id: 'santa-fe--nm--us',
  name: 'Santa Fe',
  state: 'New Mexico',
  state_code: 'NM',
  country: 'United States of America',
  country_code: 'us',
  lat: 35.687,
  lng: -105.9378,
  formatted: 'Santa Fe, New Mexico, United States of America',
};

describe('SearchBar', () => {
  it('searches after typing and opens the chosen city', async () => {
    const fetchMock = mockApi({ '/api/cities': { cities: [SANTA_FE] } });
    const user = userEvent.setup();
    renderWithProviders(<SearchBar />);

    await user.type(screen.getByRole('combobox', { name: /search for a city/i }), 'Santa Fe');
    const option = await screen.findByRole('option', { name: /santa fe/i });
    expect(option).toHaveTextContent('New Mexico, USA');

    // Debounced: one request for the whole word, not one per keystroke.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/cities?q=Santa%20Fe');

    await user.click(option);
    expect(await screen.findByTestId('other-route')).toBeInTheDocument();
  });

  it('selects the highlighted result with the keyboard', async () => {
    mockApi({ '/api/cities': { cities: [SANTA_FE, { ...SANTA_FE, id: 'santa-fe--s--ar', state: 'Santa Fe', country: 'Argentina', country_code: 'ar' }] } });
    const user = userEvent.setup();
    renderWithProviders(<SearchBar />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'Santa');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('other-route')).toBeInTheDocument();
  });

  it('tells the user when nothing matches', async () => {
    mockApi({ '/api/cities': { cities: [] } });
    const user = userEvent.setup();
    renderWithProviders(<SearchBar />);
    await user.type(screen.getByRole('combobox'), 'Qwxz');
    await waitFor(() => expect(screen.getByText(/no matching cities/i)).toBeInTheDocument());
  });
});
