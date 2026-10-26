import { describe, expect, it } from 'vitest';
import { legalMoves, outcomeOf, playOnBoard } from '../game/rules';
import { mulberry32 } from '../mcts/rng';
import { findWinningMove, rolloutMove, simulate } from '../mcts/rollout';
import { MCTSTree, rewardFor, uctValue } from '../mcts/tree';
import { DEFAULT_CONFIG, type MCTSConfig, type SearchNode } from '../mcts/types';
import { b, scripted } from './helpers';

const cfg = (over: Partial<MCTSConfig> = {}): MCTSConfig => ({ ...DEFAULT_CONFIG, ...over });
const empty = b('.........');

describe('root creation', () => {
  it('creates an unvisited root with every legal move untried', () => {
    const tree = new MCTSTree(empty, 'X', cfg(), { rng: mulberry32(1) });
    expect(tree.root).toMatchObject({ visits: 0, depth: 0, move: null, playerToMove: 'X', playerJustMoved: 'O', terminal: null });
    expect(tree.root.children).toEqual([]);
    expect([...tree.root.untriedMoves].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(tree.nodeCount).toBe(1);
  });

  it('respects the exact board and side to move', () => {
    const tree = new MCTSTree(b('X...O....'), 'X', cfg(), { rng: mulberry32(1) });
    expect(tree.root.untriedMoves.sort()).toEqual([1, 2, 3, 5, 6, 7, 8]);
  });
});

describe('UCT', () => {
  const fake = (visits: number, totalReward: number) => ({ visits, totalReward }) as SearchNode;

  it('is infinite for unvisited nodes', () => {
    expect(uctValue(fake(0, 0), 10, 1.4)).toBe(Infinity);
  });

  it('matches W/N + C·sqrt(ln Np / N)', () => {
    expect(uctValue(fake(4, 3), 20, 2)).toBeCloseTo(3 / 4 + 2 * Math.sqrt(Math.log(20) / 4), 12);
    expect(uctValue(fake(4, 3), 20, 0)).toBeCloseTo(0.75, 12);
  });

  it('rewards outcomes from a given perspective', () => {
    expect(rewardFor('X', 'X')).toBe(1);
    expect(rewardFor('X', 'O')).toBe(0);
    expect(rewardFor('draw', 'O')).toBe(0.5);
  });
});

describe('expansion', () => {
  it('never expands the same move twice', () => {
    const tree = new MCTSTree(empty, 'X', cfg(), { rng: mulberry32(3) });
    for (let i = 0; i < 9; i++) tree.expand(tree.root);
    const moves = tree.root.children.map((c) => c.move);
    expect(new Set(moves).size).toBe(9);
    expect(tree.root.untriedMoves).toEqual([]);
    expect(() => tree.expand(tree.root)).toThrow();
  });

  it('creates children with the resulting board and next player', () => {
    const tree = new MCTSTree(empty, 'O', cfg(), { rng: mulberry32(3) });
    const child = tree.expand(tree.root);
    expect(child.board[child.move as number]).toBe('O');
    expect(child.playerToMove).toBe('X');
    expect(child.playerJustMoved).toBe('O');
    expect(child.depth).toBe(1);
    expect(child.parent).toBe(tree.root);
  });

  it('visits every root move once before revisiting any (unvisited = infinite UCT)', () => {
    const tree = new MCTSTree(empty, 'X', cfg(), { rng: mulberry32(5) });
    tree.run(9);
    expect(tree.root.children).toHaveLength(9);
    expect(tree.root.children.every((c) => c.visits === 1)).toBe(true);
  });
});

describe('selection', () => {
  it('picks the child with the highest UCT', () => {
    const tree = new MCTSTree(b('XOXOXO...'), 'X', cfg({ exploration: 0 }), { simulator: scripted(['draw']), rng: mulberry32(1) });
    tree.run(3); // expands 6, 7, 8 once each
    const [a, c] = tree.root.children;
    // Pretend `c` has done better for X.
    c.totalReward = c.visits;
    a.totalReward = 0;
    expect(tree.selectChild(tree.root)).toBe(c);
  });

  it('emits selection events along the path with UCT candidates', () => {
    const tree = new MCTSTree(empty, 'X', cfg(), { rng: mulberry32(9) });
    tree.run(9);
    const events = tree.runIteration();
    const sel = events.find((e) => e.type === 'selection');
    expect(sel && sel.type === 'selection' && sel.candidates).toHaveLength(9);
    expect(events.map((e) => e.type)).toEqual([
      'selection',
      'selection-end',
      'expansion',
      'simulation',
      'backpropagation',
      'backpropagation',
      'backpropagation',
      'iteration-complete',
    ]);
  });
});

describe('simulation', () => {
  it('always ends in a terminal state using only legal moves', () => {
    const rng = mulberry32(11);
    for (const policy of ['random', 'heuristic'] as const) {
      for (let i = 0; i < 300; i++) {
        const result = simulate(empty, i % 2 ? 'X' : 'O', policy, rng);
        let board = empty;
        for (const { move, player } of result.moves) board = playOnBoard(board, move, player); // throws if illegal
        expect(outcomeOf(board)).toBe(result.outcome);
        expect(['X', 'O', 'draw']).toContain(result.outcome);
      }
    }
  });

  it('returns immediately on a terminal board', () => {
    expect(simulate(b('XXXOO....'), 'O', 'random', mulberry32(1))).toEqual({ outcome: 'X', moves: [], policy: 'random' });
  });

  it('heuristic policy wins immediately, otherwise blocks', () => {
    const rng = () => 0;
    expect(findWinningMove(b('XX.OO....'), 'X')).toBe(2);
    expect(rolloutMove(b('XX.OO....'), 'O', 'heuristic', rng)).toBe(5); // own win first
    expect(rolloutMove(b('XX..O....'), 'O', 'heuristic', rng)).toBe(2); // block
  });
});

describe('backpropagation', () => {
  it('updates visits, outcome counts and rewards from each node perspective', () => {
    const tree = new MCTSTree(empty, 'X', cfg(), { simulator: scripted(['X']), rng: mulberry32(2) });
    tree.run(1);
    const child = tree.root.children[0];
    expect(tree.root).toMatchObject({ visits: 1, outcomes: { X: 1, O: 0, draw: 0 } });
    // child was reached by an X move: X winning is a reward of 1 for it.
    expect(child).toMatchObject({ visits: 1, totalReward: 1 });
    // root's playerJustMoved is O: X winning is 0 for it.
    expect(tree.root.totalReward).toBe(0);
  });

  it('keeps visit counts consistent along the tree', () => {
    const tree = new MCTSTree(empty, 'X', cfg(), { rng: mulberry32(4) });
    tree.run(500);
    expect(tree.root.visits).toBe(500);
    expect(tree.iterations).toBe(500);
    for (const n of tree.allNodes()) {
      const o = n.outcomes;
      expect(o.X + o.O + o.draw).toBe(n.visits);
      if (n.children.length && n.terminal === null) {
        const childVisits = n.children.reduce((s, c) => s + c.visits, 0);
        // every visit except the one that expanded `n` itself went down to a child
        expect(childVisits).toBe(n === tree.root ? n.visits : n.visits - 1);
      }
    }
    const t = tree.rolloutTotals;
    expect(t.X + t.O + t.draw).toBe(500);
  });
});

describe('tree validity', () => {
  it('only contains legal, non-duplicated states', () => {
    const tree = new MCTSTree(b('X...O....'), 'X', cfg({ rolloutPolicy: 'heuristic' }), { rng: mulberry32(8) });
    tree.run(800);
    for (const n of tree.allNodes()) {
      if (!n.parent) continue;
      const p = n.parent;
      expect(n.board).toEqual(playOnBoard(p.board, n.move as number, p.playerToMove));
      expect(n.playerToMove).not.toBe(p.playerToMove);
      expect(n.depth).toBe(p.depth + 1);
    }
    for (const n of tree.allNodes()) {
      const moves = [...n.children.map((c) => c.move as number), ...n.untriedMoves].sort();
      expect(new Set(moves).size).toBe(moves.length);
      expect(moves).toEqual(legalMoves(n.board));
    }
  });
});

describe('terminal states', () => {
  it('does not expand terminal nodes and backpropagates their exact result', () => {
    // X to move can win at 2.
    const tree = new MCTSTree(b('XX.OO....'), 'X', cfg(), { rng: mulberry32(6) });
    tree.run(400);
    const win = tree.root.children.find((c) => c.move === 2)!;
    expect(win.terminal).toBe('X');
    expect(win.children).toEqual([]);
    expect(win.untriedMoves).toEqual([]);
    expect(win.outcomes).toEqual({ X: win.visits, O: 0, draw: 0 });
  });

  it('handles a terminal root explicitly', () => {
    const tree = new MCTSTree(b('XXXOO....'), 'O', cfg(), { rng: mulberry32(1) });
    expect(tree.decide()).toMatchObject({ move: null, reason: 'terminal' });
    const events = tree.runIteration();
    expect(events.find((e) => e.type === 'selection-end')).toMatchObject({ reason: 'terminal' });
    expect(tree.nodeCount).toBe(1);
  });
});

describe('final decision', () => {
  it('reports when no iteration was run', () => {
    expect(new MCTSTree(empty, 'X', cfg()).decide()).toMatchObject({ move: null, reason: 'no-iterations' });
  });

  it('chooses the most visited root child, not the highest UCT', () => {
    const tree = new MCTSTree(b('XOXOXO...'), 'X', cfg(), { simulator: scripted(['draw']), rng: mulberry32(1) });
    tree.run(3);
    const [a, c] = tree.root.children;
    a.visits = 10;
    a.totalReward = 5;
    c.visits = 2;
    c.totalReward = 2; // higher mean and UCT, fewer visits
    expect(tree.decide()).toMatchObject({ move: a.move, reason: 'most-visits', visits: 10 });
  });

  it('takes an immediate win for X and for O (reward perspective is consistent)', () => {
    const forX = new MCTSTree(b('XX.OO....'), 'X', cfg(), { rng: mulberry32(21) });
    forX.run(1500);
    expect(forX.decide().move).toBe(2);
    const forO = new MCTSTree(b('XX.OO....'), 'O', cfg(), { rng: mulberry32(21) });
    forO.run(1500);
    expect(forO.decide().move).toBe(5);
  });

  it('blocks an immediate threat', () => {
    const tree = new MCTSTree(b('XX..O....'), 'O', cfg(), { rng: mulberry32(33) });
    tree.run(3000);
    expect(tree.decide().move).toBe(2);
  });
});
