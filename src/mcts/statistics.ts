import { otherPlayer } from '../game/rules';
import type { Player } from '../game/types';
import { rewardFor, uctValue } from './tree';
import type { NodeStatistics, SearchNode } from './types';

/** Below this many visits an estimate is flagged as low-sample. */
export const LOW_SAMPLE_THRESHOLD = 10;

/** 95% Wilson score interval for a proportion. */
export function wilsonInterval(successes: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

/**
 * Empirical outcome estimates of a node from the perspective of `perspective`
 * (in the UI: always the player to move at the search root).
 * Win/draw/loss are computed from raw result counts, so they always sum to 1.
 */
export function nodeStatistics(node: SearchNode, perspective: Player, exploration: number): NodeStatistics {
  const n = node.visits;
  const wins = node.outcomes[perspective];
  const losses = node.outcomes[otherPlayer(perspective)];
  const draws = node.outcomes.draw;
  // totalReward is stored from playerJustMoved's view; convert if needed.
  const rewardSum = node.playerJustMoved === perspective ? node.totalReward : n - node.totalReward;
  return {
    perspective,
    visits: n,
    wins,
    draws,
    losses,
    winRate: n > 0 ? wins / n : null,
    drawRate: n > 0 ? draws / n : null,
    lossRate: n > 0 ? losses / n : null,
    meanReward: n > 0 ? rewardSum / n : null,
    winInterval: wilsonInterval(wins, n),
    uct: node.parent ? uctValue(node, node.parent.visits, exploration) : null,
    lowSample: n < LOW_SAMPLE_THRESHOLD,
    terminal: node.terminal,
  };
}

/** Exact value of a terminal node for `perspective` (1 win, 0.5 draw, 0 loss). */
export const terminalValue = (node: SearchNode, perspective: Player): number | null =>
  node.terminal === null ? null : rewardFor(node.terminal, perspective);
