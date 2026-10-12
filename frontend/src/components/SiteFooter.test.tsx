import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import SiteFooter from './SiteFooter';

describe('SiteFooter', () => {
  it('links to the privacy policy and the main pages', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Compare cities' })).toHaveAttribute('href', '/compare');
  });
});
