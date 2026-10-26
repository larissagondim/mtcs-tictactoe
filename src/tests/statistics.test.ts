import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../mcts/rng';
import { LOW_SAMPLE_THRESHOLD, nodeStatistics, terminalValue, wilsonInterval } from '../mcts/statistics';
import { MCTSTree } from '../mcts/tree';
import { DEFAULT_CONFIG } from '../mcts/types';
import { b, scripted } from './helpers';

const C = DEFAULT_CONFIG.exploration;

describe('per-node probabilities', () => {
  it('computes win/draw/loss from a known result sequence (root perspective)', () => {
    // Root: O to move. Results: X, X, draw, O → for O: 1 win, 1 draw, 2 losses.
    const tree = new MCTSTree(b('XOXOX....'), 'O', { ...DEFAULT_CONFIG }, { simulator: scripted(['X', 'X', 'draw', 'O']), rng: mulberry32(1) });
    tree.run(4);
    const s = nodeStatistics(tree.root, 'O', C);
    expect(s).toMatchObject({ visits: 4, wins: 1, draws: 1, losses: 2, winRate: 0.25, drawRate: 0.25, lossRate: 0.5 });
    // mean reward with draw = 0.5 is NOT the win probability
    expect(s.meanReward).toBeCloseTo(0.375);
    expect(s.winRate! + s.drawRate! + s.lossRate!).toBeCloseTo(1);
  });

  it('converts descendant statistics to the same root perspective', () => {
    const tree = new MCTSTree(b('XOXOX....'), 'O', { ...DEFAULT_CONFIG }, { simulator: scripted(['O', 'X', 'draw']), rng: mulberry32(1) });
    tree.run(3); // each of the 4 moves... first 3 get one visit each
    for (const child of tree.root.children) {
      const s = nodeStatistics(child, 'O', C);
      const o = child.outcomes;
      expect(s.wins).toBe(o.O);
      expect(s.losses).toBe(o.X);
      // the child's stored reward is from O's view (O moved into it): mean must match
      expect(s.meanReward).toBeCloseTo((o.O + 0.5 * o.draw) / child.visits);
      // and from X's view it's the complement
      expect(nodeStatistics(child, 'X', C).meanReward).toBeCloseTo((o.X + 0.5 * o.draw) / child.visits);
    }
    const grandchildTree = new MCTSTree(b('.........'), 'X', { ...DEFAULT_CONFIG }, { rng: mulberry32(7) });
    grandchildTree.run(300);
    for (const n of grandchildTree.allNodes()) {
      const s = nodeStatistics(n, 'X', C);
      if (n.visits === 0) continue;
      expect(s.winRate! + s.drawRate! + s.lossRate!).toBeCloseTo(1, 10);
    }
  });

  it('reports unvisited nodes as not estimated instead of 0%', () => {
    const tree = new MCTSTree(b('.........'), 'X', { ...DEFAULT_CONFIG }, { rng: mulberry32(1) });
    const child = tree.expand(tree.root);
    const s = nodeStatistics(child, 'X', C);
    expect(s).toMatchObject({ visits: 0, winRate: null, drawRate: null, lossRate: null, meanReward: null, winInterval: null, lowSample: true });
    expect(s.uct).toBe(Infinity);
    expect(nodeStatistics(tree.root, 'X', C).uct).toBeNull();
  });

  it('flags low samples', () => {
    const tree = new MCTSTree(b('.........'), 'X', { ...DEFAULT_CONFIG }, { simulator: scripted(['draw']), rng: mulberry32(1) });
    tree.run(LOW_SAMPLE_THRESHOLD - 1);
    expect(nodeStatistics(tree.root, 'X', C).lowSample).toBe(true);
    tree.run(1);
    expect(nodeStatistics(tree.root, 'X', C).lowSample).toBe(false);
  });

  it('identifies terminal states separately with their exact value', () => {
    const tree = new MCTSTree(b('XX.OO....'), 'X', { ...DEFAULT_CONFIG }, { rng: mulberry32(2) });
    tree.run(50);
    const win = tree.root.children.find((c) => c.move === 2)!;
    expect(nodeStatistics(win, 'X', C).terminal).toBe('X');
    expect(terminalValue(win, 'X')).toBe(1);
    expect(terminalValue(win, 'O')).toBe(0);
    expect(terminalValue(tree.root, 'X')).toBeNull();
  });
});

describe('Wilson interval', () => {
  it('is null without samples and brackets the proportion', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    const [lo, hi] = wilsonInterval(30, 100)!;
    expect(lo).toBeLessThan(0.3);
    expect(hi).toBeGreaterThan(0.3);
    expect(lo).toBeCloseTo(0.2189, 3);
    expect(hi).toBeCloseTo(0.3958, 3);
  });

  it('narrows as samples grow', () => {
    const w = (n: number) => {
      const [lo, hi] = wilsonInterval(n / 2, n)!;
      return hi - lo;
    };
    expect(w(10)).toBeGreaterThan(w(1000));
  });
});
