import { screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { toggleSaved } from '../lib/savedCities';
import { renderWithProviders } from '../test/utils';
import Header from './Header';

describe('Header', () => {
  afterEach(() => window.localStorage.clear());

  it('shows no count next to Saved until a city is saved', () => {
    renderWithProviders(<Header />);
    const saved = screen.getByRole('button', { name: /^Saved/ });
    expect(saved).toHaveTextContent(/^Saved$/);
    act(() => toggleSaved({ id: 'lisbon--pt', name: 'Lisbon', country: 'Portugal' }));
    expect(saved).toHaveTextContent(/^Saved1$/);
  });

  it('has the °C and °F switch', () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole('group', { name: 'Temperature units' })).toBeInTheDocument();
  });
});
