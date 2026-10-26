import { describe, expect, it } from 'vitest';
import { compareSampleSizes, explorationProfile } from '../mcts/experiments';
import { b } from './helpers';

const empty = b('.........');

describe('exploration profile', () => {
  it('accounts for every root visit', () => {
    const p = explorationProfile(empty, 'X', 1.4, 300, 1);
    expect(p.moves.reduce((s, m) => s + m.visits, 0)).toBe(300);
    expect(p.moves.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1);
  });

  it('concentrates visits more with low C than with high C', () => {
    const low = explorationProfile(empty, 'X', 0.1, 2000, 3);
    const high = explorationProfile(empty, 'X', 3, 2000, 3);
    expect(low.topShare).toBeGreaterThan(high.topShare);
  });
});

describe('short vs long searches', () => {
  it('long searches give a narrower spread of estimates', () => {
    const cmp = compareSampleSizes(empty, 'X', 30, 2000, 5, 11);
    const width = (k: 'short' | 'long') => {
      const ws = cmp.moves.map((m) => m[k]).filter((s) => s !== null).map((s) => s!.max - s!.min);
      return ws.reduce((a, w) => a + w, 0) / ws.length;
    };
    expect(width('long')).toBeLessThan(width('short'));
    expect(Object.values(cmp.decisions.long).reduce((a, n) => a + n, 0)).toBe(5);
  });
});
