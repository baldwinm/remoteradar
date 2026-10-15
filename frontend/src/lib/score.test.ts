import { describe, expect, it } from 'vitest';

import type { ScoreFactor } from '../api/types';
import { tierOf, verdict } from './score';

function factor(key: ScoreFactor['key'], score: number | null): ScoreFactor {
  return { key, name: key, weight: 25, score, detail: '' };
}

describe('tierOf', () => {
  it('uses the same cut-offs as the API', () => {
    expect(tierOf(80)).toEqual({ key: 'excellent', label: 'Excellent' });
    expect(tierOf(79).key).toBe('good');
    expect(tierOf(65).key).toBe('good');
    expect(tierOf(64).key).toBe('fair');
    expect(tierOf(50).key).toBe('fair');
    expect(tierOf(49)).toEqual({ key: 'low', label: 'Challenging' });
    expect(tierOf(null).key).toBe('none');
    expect(tierOf(undefined).key).toBe('none');
  });
});

describe('verdict', () => {
  it('names the strengths, then the catch', () => {
    const factors = [factor('internet', 90), factor('places', 94), factor('cost', 57), factor('climate', 70)];
    expect(verdict(factors)).toBe('Fast internet and lots of places to work. The catch: hotels cost more than in most cities.');
    expect(verdict(factors, true)).toBe('Fast internet and lots of places to work. Hotels are pricey.');
  });

  it('leaves out factors without data', () => {
    expect(verdict([factor('internet', null), factor('climate', 85)])).toBe('A mild climate.');
  });

  it('says so when nothing stands out', () => {
    expect(verdict([factor('internet', 70), factor('cost', 72)])).toBe('Solid all round, with no big strengths or weak spots.');
  });
});
