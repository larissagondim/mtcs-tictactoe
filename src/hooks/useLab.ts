import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { applyMove, createGame, isLegalMove } from '../game/rules';
import type { GameState, Move, Player } from '../game/types';
import { SearchController } from '../mcts/controller';
import { DEFAULT_CONFIG, type Decision, type MCTSConfig } from '../mcts/types';

export type Speed = 'step' | 'normal' | 'fast';

/** The human always plays X, the AI always plays O. */
export const HUMAN: Player = 'X';
export const AI: Player = 'O';

/** Fixed AI settings: real MCTS with classic UCT and random playouts. */
export const AI_CONFIG: MCTSConfig = { ...DEFAULT_CONFIG, iterations: 500 };

/** Pause before the AI's chosen move is played, so the decision is visible. */
const AI_MOVE_DELAY = 900;

const isAiTurn = (g: GameState) => g.outcome === null && g.toMove === AI;

export function useLab() {
  const [starter, setStarterState] = useState<Player>(HUMAN);
  const [game, setGame] = useState<GameState>(() => createGame(HUMAN));
  const [speed, setSpeedState] = useState<Speed>('normal');
  const [controller] = useState(() => {
    const c = new SearchController(game.board, game.toMove, AI_CONFIG);
    applySpeed(c, 'normal');
    return c;
  });
  const version = useSyncExternalStore(controller.subscribe, controller.getVersion);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingAiMove, setPendingAiMove] = useState<Move | null>(null);

  /** Single entry point for every position change. */
  const loadPosition = useCallback(
    (next: GameState, reason: string, keepTree = false) => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      aiTimer.current = null;
      setPendingAiMove(null);
      setGame(next);
      const aiNext = isAiTurn(next);
      // After the AI moves, keep its tree on screen so the decision can be studied.
      if (keepTree && !aiNext) return;
      controller.reset(next.board, next.toMove, AI_CONFIG, reason);
      if (aiNext) controller.start();
    },
    [controller],
  );

  // When a search finishes, the AI plays the chosen move (if the position is still current).
  useEffect(() =>
    controller.setOnComplete((decision: Decision) => {
      if (decision.move === null || !isAiTurn(game)) return;
      if (controller.tree.root.board.some((c, i) => c !== game.board[i])) return;
      const move = decision.move;
      setPendingAiMove(move);
      aiTimer.current = setTimeout(() => {
        aiTimer.current = null;
        setPendingAiMove(null);
        loadPosition(applyMove(game, move), 'Nova posição após a jogada da IA.', true);
      }, AI_MOVE_DELAY);
    }),
  );

  useEffect(
    () => () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      controller.dispose();
    },
    [controller],
  );

  const playCell = (cell: Move) => {
    if (game.toMove !== HUMAN || game.outcome !== null || !isLegalMove(game.board, cell)) return;
    loadPosition(applyMove(game, cell), 'Nova posição após a sua jogada.');
  };

  const newGame = (first: Player = starter) => loadPosition(createGame(first), 'Nova partida.');

  const setStarter = (p: Player) => {
    setStarterState(p);
    newGame(p);
  };

  /** Throws away the current search tree and, on the AI's turn, searches again from scratch. */
  const restartSearch = () => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    aiTimer.current = null;
    setPendingAiMove(null);
    controller.reset(game.board, game.toMove, AI_CONFIG, 'Busca reiniciada.');
    if (isAiTurn(game)) controller.start();
  };

  const setSpeed = (s: Speed) => {
    setSpeedState(s);
    applySpeed(controller, s);
  };

  const rootMatchesGame =
    controller.tree.root.board.every((c, i) => c === game.board[i]) && controller.tree.rootPlayer === game.toMove;

  return {
    version,
    controller,
    game,
    starter,
    setStarter,
    playCell,
    newGame: () => newGame(),
    restartSearch,
    pendingAiMove,
    aiTurn: isAiTurn(game),
    speed,
    setSpeed,
    treeIsCurrent: rootMatchesGame,
  };
}

function applySpeed(c: SearchController, s: Speed) {
  c.setDetailed(s === 'step');
  c.setSpeed(s === 'step' ? 'slow' : s);
}

export type Lab = ReturnType<typeof useLab>;
