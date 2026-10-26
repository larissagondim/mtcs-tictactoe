export type Player = 'X' | 'O';
export type Cell = Player | null;
/** 9 cells in row-major order: index = row * 3 + col. */
export type Board = readonly Cell[];
/** A move is the index (0–8) of the cell being played. */
export type Move = number;
/** Final result of a finished game. */
export type Outcome = Player | 'draw';

export interface GameState {
  board: Board;
  /** Player who makes the next move. */
  toMove: Player;
  startingPlayer: Player;
  /** null while the game is running. */
  outcome: Outcome | null;
  winningLine: readonly number[] | null;
  lastMove: Move | null;
  history: readonly Move[];
}
