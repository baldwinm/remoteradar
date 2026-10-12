import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Place } from '../api/types';
import PlacesList from './PlacesList';

function place(id: string, type: Place['type'], extra: Partial<Place> = {}): Place {
  return {
    id,
    name: `${type} ${id}`,
    type,
    address: '1 Main St',
    rating: 4.5,
    user_ratings_total: 10,
    price_level: null,
    lat: 0,
    lng: 0,
    website: null,
    phone: null,
    maps_url: `https://maps.google.com/?cid=${id}`,
    ...extra,
  };
}

describe('PlacesList', () => {
  const places = [
    place('1', 'coffee', { website: 'https://coffee.example' }),
    place('2', 'restaurant', { price_level: 1 }),
    place('3', 'restaurant', { price_level: 3 }),
    ...Array.from({ length: 6 }, (_, i) => place(`c${i}`, 'coworking')),
  ];

  it('filters by category and restaurant budget', async () => {
    const user = userEvent.setup();
    render(<PlacesList places={places} />);

    expect(screen.getByText('Found 9 places')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restaurants' }));
    expect(screen.getByText('Found 2 places')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '$$$' }));
    expect(screen.getByText('Found 1 places')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'restaurant 3' })).toBeInTheDocument();
  });

  it('links to the website when there is one, otherwise to Google Maps', () => {
    render(<PlacesList places={places.slice(0, 2)} />);
    expect(screen.getByRole('link', { name: 'coffee 1' })).toHaveAttribute('href', 'https://coffee.example');
    expect(screen.getByRole('link', { name: 'restaurant 2' })).toHaveAttribute('href', 'https://maps.google.com/?cid=2');
  });

  it('paginates five at a time', async () => {
    const user = userEvent.setup();
    render(<PlacesList places={places} />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('warns when some categories are missing', () => {
    render(<PlacesList places={places} partial />);
    expect(screen.getByText(/may be incomplete/i)).toBeInTheDocument();
  });
});
