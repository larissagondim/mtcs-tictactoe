import { boardKey, emptyBoard, findWin, legalMoves, otherPlayer, playOnBoard, WIN_LINES } from './rules';
import type { Board, Player } from './types';

export interface PositionValidation {
  /** Reachable by a legal sequence of moves starting from an empty board. */
  reachable: boolean;
  /** Possible starting players that lead to this position with `toMove` to play. */
  startingPlayers: Player[];
  /** Human-readable problems (pt-BR). Empty when reachable. */
  issues: string[];
}

let reachableCache: Map<string, Set<Player>> | null = null;

/** Map from `${board}|${toMove}` to the starting players that can reach it. */
function reachableStates(): Map<string, Set<Player>> {
  if (reachableCache) return reachableCache;
  const map = new Map<string, Set<Player>>();
  const visit = (board: Board, toMove: Player, starter: Player) => {
    const key = `${boardKey(board)}|${toMove}`;
    let starters = map.get(key);
    if (!starters) map.set(key, (starters = new Set()));
    if (starters.has(starter)) return;
    starters.add(starter);
    for (const m of legalMoves(board)) visit(playOnBoard(board, m, toMove), otherPlayer(toMove), starter);
  };
  visit(emptyBoard(), 'X', 'X');
  visit(emptyBoard(), 'O', 'O');
  reachableCache = map;
  return map;
}

export function validatePosition(board: Board, toMove: Player): PositionValidation {
  const starters = reachableStates().get(`${boardKey(board)}|${toMove}`);
  if (starters && starters.size > 0) {
    return { reachable: true, startingPlayers: [...starters].sort(), issues: [] };
  }

  const issues: string[] = [];
  const x = board.filter((c) => c === 'X').length;
  const o = board.filter((c) => c === 'O').length;
  if (Math.abs(x - o) > 1) issues.push(`Contagem impossível de peças: ${x} X e ${o} O (diferença maior que 1).`);
  else if (x > o && toMove === 'X') issues.push('X tem uma peça a mais, então deveria ser a vez de O.');
  else if (o > x && toMove === 'O') issues.push('O tem uma peça a mais, então deveria ser a vez de X.');

  const winners = new Set<Player>();
  let xLines = 0;
  let oLines = 0;
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      winners.add(v);
      if (v === 'X') xLines++;
      else oLines++;
    }
  }
  if (winners.size === 2) issues.push('X e O têm linhas completas ao mesmo tempo.');
  const win = findWin(board);
  if (win && winners.size === 1 && win.winner === toMove) {
    issues.push(`${win.winner} já venceu, mas o turno indica que ${win.winner} jogaria de novo após a vitória.`);
  }
  if (xLines + oLines > 1 && winners.size === 1) {
    issues.push('Há mais de uma linha vencedora que não poderia ter sido formada com uma única jogada final.');
  }
  if (issues.length === 0) issues.push('A posição não pode ser alcançada por uma sequência legal de jogadas.');
  return { reachable: false, startingPlayers: [], issues };
}
