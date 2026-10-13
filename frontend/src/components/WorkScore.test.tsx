import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WorkScore } from '../api/types';
import { mockApi, renderWithProviders } from '../test/utils';
import { ScoreBadge, ScoreCard, tierFor } from './WorkScore';

const SCORE: WorkScore = {
  score: 84,
  tier: 'excellent',
  label: 'Excellent',
  counted: 3,
  factors: [
    {
      key: 'internet',
      name: 'Internet',
      weight: 35,
      score: 91,
      detail: '146 Mbps down, 38 up, 9 ms latency at home',
    },
    {
      key: 'places',
      name: 'Places to work',
      weight: 35,
      score: 88,
      detail: '20 coworking spaces, 20 cafés',
    },
    {
      key: 'cost',
      name: 'Cost',
      weight: 30,
      score: 62,
      detail: 'Average hotel night $112, a week from now',
    },
    { key: 'climate', name: 'Climate', weight: 0, score: null, detail: '' },
  ],
};

describe('remote work score', () => {
  it('colors scores with the same cut-offs as the API', () => {
    expect([95, 80, 79, 65, 64, 50, 49].map(tierFor)).toEqual([
      'excellent',
      'excellent',
      'good',
      'good',
      'fair',
      'fair',
      'low',
    ]);
  });

  it('shows the score with its tier color beside the city name', async () => {
    mockApi({ '/api/cities/lisbon--pt/score': SCORE });
    const { container } = renderWithProviders(<ScoreBadge cityId="lisbon--pt" />);
    expect(await screen.findByText('Excellent')).toBeInTheDocument();
    expect(container.querySelector('.score-ring.tier-excellent')).toHaveTextContent('84');
  });

  it('breaks the score down by factor and marks missing ones', async () => {
    mockApi({ '/api/cities/lisbon--pt/score': SCORE });
    const { container } = renderWithProviders(<ScoreCard cityId="lisbon--pt" cityName="Lisbon" />);
    expect(await screen.findByText('Average hotel night $112, a week from now')).toBeInTheDocument();
    expect(screen.getAllByText('35% of score', { exact: false })).toHaveLength(2);
    expect(screen.getByText('not counted')).toBeInTheDocument();
    expect(screen.getByText('Based on 3 of 4 factors')).toBeInTheDocument();
    expect(container.querySelector('.score-factor.tier-fair')).toHaveTextContent('Cost');
  });

  it('hides the badge when there is not enough data', async () => {
    mockApi({
      '/api/cities/x--us/score': {
        ...SCORE,
        score: null,
        tier: 'none',
        label: '',
        counted: 2,
      },
    });
    const { container } = renderWithProviders(<ScoreCard cityId="x--us" cityName="X" />);
    expect(await screen.findByText(/only 2 of 4 factors/)).toBeInTheDocument();
    renderWithProviders(<ScoreBadge cityId="x--us" />);
    expect(container.querySelector('.score-badge')).toBeNull();
  });
});
