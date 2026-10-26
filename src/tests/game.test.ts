import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  findWin,
  gameFromBoard,
  IllegalMoveError,
  isLegalMove,
  legalMoves,
  moveLabel,
  outcomeOf,
} from '../game/rules';
import { b } from './helpers';

const playAll = (moves: number[], starter: 'X' | 'O' = 'X') => moves.reduce(applyMove, createGame(starter));

describe('win detection', () => {
  it('detects horizontal wins', () => {
    expect(findWin(b('XXX.OO...'))).toEqual({ winner: 'X', line: [0, 1, 2] });
    expect(findWin(b('XX.OOO.X.'))?.line).toEqual([3, 4, 5]);
    expect(findWin(b('X.X.X.OOO'))?.winner).toBe('O');
  });

  it('detects vertical wins', () => {
    expect(findWin(b('OX.OX..X.'))).toEqual({ winner: 'X', line: [1, 4, 7] });
    expect(findWin(b('O.XO.XO..'))?.line).toEqual([0, 3, 6]);
  });

  it('detects diagonal wins', () => {
    expect(findWin(b('X.O.XO..X'))).toEqual({ winner: 'X', line: [0, 4, 8] });
    expect(findWin(b('X.O.OXO.X'))).toEqual({ winner: 'O', line: [2, 4, 6] });
  });

  it('detects a draw on a full board without a winner', () => {
    const draw = b('XOXXOOOXX');
    expect(findWin(draw)).toBeNull();
    expect(outcomeOf(draw)).toBe('draw');
  });

  it('returns null for a running game', () => {
    expect(outcomeOf(b('X...O....'))).toBeNull();
  });
});

describe('legal moves', () => {
  it('lists every empty cell', () => {
    expect(legalMoves(b('X...O....'))).toEqual([1, 2, 3, 5, 6, 7, 8]);
  });

  it('has no moves on a full board', () => {
    expect(legalMoves(b('XOXXOOOXX'))).toEqual([]);
  });

  it('has no moves once someone has won, even with empty cells', () => {
    expect(legalMoves(b('XXXOO....'))).toEqual([]);
    expect(isLegalMove(b('XXXOO....'), 8)).toBe(false);
  });
});

describe('game flow', () => {
  it('alternates players starting with the chosen player', () => {
    const g = playAll([4], 'O');
    expect(g.board[4]).toBe('O');
    expect(g.toMove).toBe('X');
    expect(g.lastMove).toBe(4);
  });

  it('rejects moves on occupied cells', () => {
    const g = playAll([0]);
    expect(() => applyMove(g, 0)).toThrow(IllegalMoveError);
  });

  it('rejects out of range cells', () => {
    expect(() => applyMove(createGame(), 9)).toThrow(IllegalMoveError);
    expect(() => applyMove(createGame(), -1)).toThrow(IllegalMoveError);
  });

  it('ends immediately on a win and blocks further moves', () => {
    // X: 0,1,2  O: 3,4
    const g = playAll([0, 3, 1, 4, 2]);
    expect(g.outcome).toBe('X');
    expect(g.winningLine).toEqual([0, 1, 2]);
    expect(() => applyMove(g, 8)).toThrow(/terminou/);
  });

  it('recognises a draw', () => {
    const g = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(g.outcome).toBe('draw');
    expect(() => applyMove(g, 0)).toThrow(IllegalMoveError);
  });

  it('labels moves with coordinates', () => {
    expect(moveLabel(0)).toBe('A1');
    expect(moveLabel(4)).toBe('B2');
    expect(moveLabel(8)).toBe('C3');
  });

  it('builds a terminal state from an arbitrary board', () => {
    expect(gameFromBoard(b('OOOXX.X..'), 'X').outcome).toBe('O');
  });
});
