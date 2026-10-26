import type { Board, Move, Player } from '../game/types';
import { mulberry32 } from './rng';
import { MCTSTree } from './tree';
import { DEFAULT_CONFIG, type RolloutPolicy } from './types';

export interface ExplorationProfile {
  exploration: number;
  iterations: number;
  /** Share of root visits per move, most visited first. */
  moves: { move: Move; visits: number; share: number }[];
  topShare: number;
  nodeCount: number;
  maxDepth: number;
}

/** Runs one real search and summarises how its visits spread over the root moves. */
export function explorationProfile(
  board: Board,
  toMove: Player,
  exploration: number,
  iterations: number,
  seed: number,
  rolloutPolicy: RolloutPolicy = 'random',
): ExplorationProfile {
  const tree = new MCTSTree(board, toMove, { ...DEFAULT_CONFIG, exploration, iterations, rolloutPolicy }, { rng: mulberry32(seed) });
  tree.run(iterations);
  const total = Math.max(1, tree.root.visits);
  const moves = tree.root.children
    .map((c) => ({ move: c.move as Move, visits: c.visits, share: c.visits / total }))
    .sort((a, b) => b.visits - a.visits);
  return { exploration, iterations, moves, topShare: moves[0]?.share ?? 0, nodeCount: tree.nodeCount, maxDepth: tree.maxDepth };
}

export interface Spread {
  min: number;
  max: number;
  mean: number;
  /** Runs in which the move received at least one visit. */
  runs: number;
}

export interface SampleSizeComparison {
  shortIterations: number;
  longIterations: number;
  runs: number;
  moves: { move: Move; short: Spread | null; long: Spread | null }[];
  /** How many runs picked each move as final decision. */
  decisions: { short: Record<number, number>; long: Record<number, number> };
}

/**
 * Repeats short and long searches with different seeds and reports the range of
 * win-rate estimates per root move (root player's perspective).
 */
export function compareSampleSizes(
  board: Board,
  toMove: Player,
  shortIterations: number,
  longIterations: number,
  runs: number,
  seed: number,
): SampleSizeComparison {
  const collect = (iterations: number, offset: number) => {
    const perMove = new Map<Move, number[]>();
    const decisions: Record<number, number> = {};
    for (let r = 0; r < runs; r++) {
      const tree = new MCTSTree(board, toMove, { ...DEFAULT_CONFIG, iterations }, { rng: mulberry32(seed + offset + r * 7919) });
      tree.run(iterations);
      for (const c of tree.root.children) {
        if (c.visits === 0) continue;
        const list = perMove.get(c.move as Move) ?? [];
        list.push(c.outcomes[toMove] / c.visits);
        perMove.set(c.move as Move, list);
      }
      const d = tree.decide();
      if (d.move !== null) decisions[d.move] = (decisions[d.move] ?? 0) + 1;
    }
    return { perMove, decisions };
  };
  const spread = (xs: number[] | undefined): Spread | null =>
    xs && xs.length ? { min: Math.min(...xs), max: Math.max(...xs), mean: xs.reduce((s, x) => s + x, 0) / xs.length, runs: xs.length } : null;

  const s = collect(shortIterations, 0);
  const l = collect(longIterations, 100_000);
  const moves = [...new Set([...s.perMove.keys(), ...l.perMove.keys()])]
    .sort((a, b) => a - b)
    .map((move) => ({ move, short: spread(s.perMove.get(move)), long: spread(l.perMove.get(move)) }));
  return { shortIterations, longIterations, runs, moves, decisions: { short: s.decisions, long: l.decisions } };
}
