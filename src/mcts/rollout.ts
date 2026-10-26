import { legalMoves, otherPlayer, outcomeOf, playOnBoard, WIN_LINES } from '../game/rules';
import type { Board, Move, Player } from '../game/types';
import { pick } from './rng';
import type { RolloutPolicy, Rng, SimulationResult } from './types';

/** Cell that completes a line for `player`, or null. */
export function findWinningMove(board: Board, player: Player): Move | null {
  for (const [a, b, c] of WIN_LINES) {
    const cells = [board[a], board[b], board[c]];
    const own = cells.filter((v) => v === player).length;
    const empty = [a, b, c].filter((i) => board[i] === null);
    if (own === 2 && empty.length === 1) return empty[0];
  }
  return null;
}

/** Chooses a rollout move: random, or "win now, else block, else random". */
export function rolloutMove(board: Board, player: Player, policy: RolloutPolicy, rng: Rng): Move {
  if (policy === 'heuristic') {
    const win = findWinningMove(board, player);
    if (win !== null) return win;
    const block = findWinningMove(board, otherPlayer(player));
    if (block !== null) return block;
  }
  return pick(legalMoves(board), rng);
}

/** Plays legal moves from `board` until the game ends. */
export function simulate(board: Board, toMove: Player, policy: RolloutPolicy, rng: Rng): SimulationResult {
  const moves: SimulationResult['moves'] = [];
  let current = board;
  let player = toMove;
  let outcome = outcomeOf(current);
  while (outcome === null) {
    const move = rolloutMove(current, player, policy, rng);
    current = playOnBoard(current, move, player); // throws on an illegal move
    moves.push({ move, player });
    player = otherPlayer(player);
    outcome = outcomeOf(current);
  }
  return { outcome, moves, policy };
}
