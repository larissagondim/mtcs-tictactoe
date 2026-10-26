import type { Board, Cell, GameState, Move, Outcome, Player } from './types';

export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

export const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null);

export const otherPlayer = (p: Player): Player => (p === 'X' ? 'O' : 'X');

export function findWin(board: Board): { winner: Player; line: readonly number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v !== null && v === board[b] && v === board[c]) return { winner: v, line };
  }
  return null;
}

/** Returns the outcome if the board is terminal, otherwise null. */
export function outcomeOf(board: Board): Outcome | null {
  const win = findWin(board);
  if (win) return win.winner;
  return board.every((c) => c !== null) ? 'draw' : null;
}

/** Legal moves for a board; empty when the position is terminal. */
export function legalMoves(board: Board): Move[] {
  if (outcomeOf(board) !== null) return [];
  const moves: Move[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === null) moves.push(i);
  return moves;
}

export function isLegalMove(board: Board, move: Move): boolean {
  return Number.isInteger(move) && move >= 0 && move < 9 && board[move] === null && outcomeOf(board) === null;
}

/** Pure board transition used by the search (no history bookkeeping). */
export function playOnBoard(board: Board, move: Move, player: Player): Cell[] {
  if (!isLegalMove(board, move)) throw new IllegalMoveError(`Jogada ilegal na célula ${move}`);
  const next = board.slice();
  next[move] = player;
  return next;
}

export function createGame(startingPlayer: Player = 'X'): GameState {
  return {
    board: emptyBoard(),
    toMove: startingPlayer,
    startingPlayer,
    outcome: null,
    winningLine: null,
    lastMove: null,
    history: [],
  };
}

/** Builds a game state from an arbitrary board (analysis mode). */
export function gameFromBoard(board: Board, toMove: Player, startingPlayer: Player = toMove): GameState {
  const win = findWin(board);
  return {
    board: board.slice(),
    toMove,
    startingPlayer,
    outcome: outcomeOf(board),
    winningLine: win ? win.line : null,
    lastMove: null,
    history: [],
  };
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.outcome !== null) throw new IllegalMoveError('A partida já terminou');
  if (!Number.isInteger(move) || move < 0 || move > 8) throw new IllegalMoveError(`Célula inválida: ${move}`);
  if (state.board[move] !== null) throw new IllegalMoveError(`Célula ${moveLabel(move)} já está ocupada`);
  const board = playOnBoard(state.board, move, state.toMove);
  const win = findWin(board);
  return {
    board,
    toMove: otherPlayer(state.toMove),
    startingPlayer: state.startingPlayer,
    outcome: outcomeOf(board),
    winningLine: win ? win.line : null,
    lastMove: move,
    history: [...state.history, move],
  };
}

/** Spreadsheet-like coordinate: columns A–C, rows 1–3 (top row = 1). */
export function moveLabel(move: Move): string {
  return `${'ABC'[move % 3]}${Math.floor(move / 3) + 1}`;
}

export function boardKey(board: Board): string {
  return board.map((c) => c ?? '.').join('');
}
