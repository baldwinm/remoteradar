import type { ScoreFactor, ScoreFactorKey, ScoreTier } from '../api/types';

export interface Tier {
  key: ScoreTier;
  label: string;
}

/** Same cut-offs as the API, for coloring the score and each factor. */
export function tierOf(score: number | null | undefined): Tier {
  if (score === null || score === undefined) return { key: 'none', label: '' };
  if (score >= 80) return { key: 'excellent', label: 'Excellent' };
  if (score >= 65) return { key: 'good', label: 'Good' };
  if (score >= 50) return { key: 'fair', label: 'Fair' };
  return { key: 'low', label: 'Challenging' };
}

const STRENGTHS: Record<ScoreFactorKey, string> = {
  internet: 'fast internet',
  places: 'lots of places to work',
  climate: 'a mild climate',
  cost: 'low prices',
};

const CATCHES: Record<ScoreFactorKey, string> = {
  internet: 'internet is on the slow side',
  places: 'there are few places to work',
  climate: 'the weather can be rough',
  cost: 'hotels cost more than in most cities',
};

const SHORT_CATCHES: Record<ScoreFactorKey, string> = {
  internet: 'internet is slow',
  places: 'few places to work',
  climate: 'the weather can be rough',
  cost: 'hotels are pricey',
};

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One or two sentences written from the factors: what's strong, then the catch. `short` is for phones. */
export function verdict(factors: ScoreFactor[], short = false): string {
  const scored = factors.filter((factor) => factor.score !== null);
  const strengths = scored.filter((factor) => (factor.score ?? 0) >= 80).map((factor) => STRENGTHS[factor.key]);
  const weak = scored.filter((factor) => (factor.score ?? 0) < 65).map((factor) => factor.key);
  let text = strengths.length ? `${capitalize(list(strengths))}.` : '';
  if (weak.length) {
    if (short) {
      const catches = list(weak.map((key) => SHORT_CATCHES[key]));
      text += `${text ? ' ' : ''}${capitalize(catches)}.`;
    } else {
      const catches = list(weak.map((key) => CATCHES[key]));
      text += text ? ` The catch: ${catches}.` : `${capitalize(catches)}.`;
    }
  }
  return text || 'Solid all round, with no big strengths or weak spots.';
}
