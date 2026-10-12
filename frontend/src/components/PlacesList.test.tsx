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
    opening_hours: null,
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

    expect(screen.getByText('9 places')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restaurants' }));
    expect(screen.getByText('2 places')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '$$$' }));
    expect(screen.getByText('1 place')).toBeInTheDocument();
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

  it('filters to places open now in the city time zone', async () => {
    const user = userEvent.setup();
    const always = [{ open_day: 0, open_minute: 0, close_day: null, close_minute: null }];
    const never = [{ open_day: 0, open_minute: 0, close_day: 0, close_minute: 1 }];
    render(
      <PlacesList
        places={[
          place('open', 'coffee', { opening_hours: always }),
          place('shut', 'coffee', { opening_hours: never }),
        ]}
        timeZone="Europe/Lisbon"
      />,
    );
    expect(screen.getByText('Open 24 hours')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open now' }));
    expect(screen.getByText('1 place')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'coffee shut' })).not.toBeInTheDocument();
  });

  it('keeps on-demand categories out of All and shows them once loaded', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PlacesList places={places} extraStatus="pending" />);
    await user.click(screen.getByRole('button', { name: 'Gyms' }));
    expect(screen.getByText(/finding gym spots/i)).toBeInTheDocument();

    rerender(<PlacesList places={[...places, place('g1', 'gym')]} extraStatus="success" />);
    expect(screen.getByText('1 place')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('9 places')).toBeInTheDocument();
  });
});
