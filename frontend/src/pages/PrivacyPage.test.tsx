import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CONTACT_EMAIL } from '../config';
import { renderWithProviders } from '../test/utils';
import PrivacyPage from './PrivacyPage';

describe('PrivacyPage', () => {
  it('lists everything kept on the device, including the °C or °F choice', () => {
    renderWithProviders(<PrivacyPage />, { path: '/privacy', route: '/privacy' });
    const device = screen.getByRole('region', { name: "What's stored on your device" });
    expect(within(device).getByText('Your light or dark theme choice')).toBeInTheDocument();
    expect(within(device).getByText('Whether temperatures show in °C or °F')).toBeInTheDocument();
    expect(within(device).getByText('Cities you save, and cities you recently viewed')).toBeInTheDocument();
  });

  it('says which services see the IP address', () => {
    renderWithProviders(<PrivacyPage />, { path: '/privacy', route: '/privacy' });
    const table = screen.getByRole('table', { name: /whether they see your IP address/ });
    const mapbox = within(table).getByRole('rowheader', { name: 'Mapbox' }).closest('[role="row"]') as HTMLElement;
    expect(within(mapbox).getByText('Yes, loads in your browser')).toBeInTheDocument();
    const places = within(table).getByRole('rowheader', { name: 'Google Places' }).closest('[role="row"]') as HTMLElement;
    expect(within(places).getByText('No')).toBeInTheDocument();
  });

  it('gives the contact address with a way to copy it', () => {
    renderWithProviders(<PrivacyPage />, { path: '/privacy', route: '/privacy#contact' });
    expect(screen.getByRole('link', { name: CONTACT_EMAIL })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
  });
});
