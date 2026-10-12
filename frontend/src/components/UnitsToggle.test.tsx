import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import UnitsToggle from './UnitsToggle';

describe('UnitsToggle', () => {
  it('reports unit changes to the page', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<UnitsToggle units="imperial" onChange={onChange} />);
    expect(screen.getByRole('button', { name: '°F' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '°C' }));
    expect(onChange).toHaveBeenCalledWith('metric');
  });
});
