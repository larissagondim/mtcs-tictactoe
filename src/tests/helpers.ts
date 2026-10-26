import type { Board, Cell, Outcome } from '../game/types';
import type { Simulator } from '../mcts/tree';

/** Parses a 9-char string like "XO.X.O..." into a board. */
export const b = (s: string): Board => s.split('').map((c): Cell => (c === 'X' || c === 'O' ? c : null));

/** Simulator that returns a fixed sequence of outcomes, without playing moves. */
export const scripted = (outcomes: Outcome[]): Simulator => {
  let i = 0;
  return () => ({ outcome: outcomes[i++ % outcomes.length], moves: [], policy: 'random' });
};
