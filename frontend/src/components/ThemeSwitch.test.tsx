import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { setThemeChoice } from '../lib/theme';
import ThemeSwitch from './ThemeSwitch';

describe('ThemeSwitch', () => {
  afterEach(() => setThemeChoice('system'));

  it('follows the device until a theme is picked, and remembers the pick', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);
    expect(screen.getByRole('button', { name: 'Match device' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('rr-theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Match device' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem('rr-theme')).toBeNull();
  });
});
