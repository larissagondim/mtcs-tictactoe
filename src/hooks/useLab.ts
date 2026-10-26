import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { applyMove, createGame, gameFromBoard, isLegalMove, otherPlayer } from '../game/rules';
import type { Cell, GameState, Move, Player } from '../game/types';
import { validatePosition, type PositionValidation } from '../game/validation';
import { SearchController, type AnimationSpeed } from '../mcts/controller';
import { DEFAULT_CONFIG, type Decision, type MCTSConfig } from '../mcts/types';

export type GameMode = 'pva' | 'ava' | 'analysis';
export type AnalysisTool = 'play' | 'edit';

/** Pause before the AI's chosen move is played, so the decision is visible. */
const AI_MOVE_DELAY = 600;

const isAiTurn = (g: GameState, mode: GameMode, human: Player) =>
  g.outcome === null && (mode === 'ava' || (mode === 'pva' && g.toMove !== human));

export function useLab() {
  const [mode, setModeState] = useState<GameMode>('pva');
  const [humanPlayer, setHumanPlayerState] = useState<Player>('X');
  const [starter, setStarterState] = useState<Player>('X');
  const [game, setGame] = useState<GameState>(() => createGame('X'));
  const [configs, setConfigs] = useState<Record<Player, MCTSConfig>>(() => ({
    X: { ...DEFAULT_CONFIG },
    O: { ...DEFAULT_CONFIG },
  }));
  const [avaEditing, setAvaEditing] = useState<Player>('X');
  const [autoPlay, setAutoPlay] = useState(true);
  const [analysisTool, setAnalysisTool] = useState<AnalysisTool>('play');
  const [controller] = useState(() => {
    const c = new SearchController(game.board, game.toMove, configs[otherPlayer(humanPlayer)]);
    c.setDetailed(false);
    c.setSpeed('fast');
    return c;
  });
  const version = useSyncExternalStore(controller.subscribe, controller.getVersion);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingAiMove, setPendingAiMove] = useState<Move | null>(null);

  const clearAiTimer = () => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    aiTimer.current = null;
    setPendingAiMove(null);
  };

  /** Single entry point for every position change: the search tree is reset explicitly. */
  const loadPosition = useCallback(
    (
      next: GameState,
      reason: string,
      opts: { mode?: GameMode; human?: Player; cfg?: Record<Player, MCTSConfig>; keepTree?: boolean } = {},
    ) => {
      const m = opts.mode ?? mode;
      const h = opts.human ?? humanPlayer;
      const cfg = opts.cfg ?? configs;
      if (aiTimer.current) clearTimeout(aiTimer.current);
      aiTimer.current = null;
      setPendingAiMove(null);
      setGame(next);
      const aiNext = isAiTurn(next, m, h);
      if (opts.keepTree && !aiNext) {
        // Keep the tree that produced the AI move so it can still be studied;
        // it is replaced (and that is logged) when the next search starts.
        return;
      }
      controller.reset(next.board, next.toMove, cfg[next.toMove], reason);
      if (aiNext) controller.start();
    },
    [controller, mode, humanPlayer, configs],
  );

  // The controller calls back when a search completes; the AI plays only if the
  // searched position is still the current one and it is really the AI's turn.
  useEffect(() =>
    controller.setOnComplete((decision: Decision) => {
      if (!autoPlay || decision.move === null || !isAiTurn(game, mode, humanPlayer)) return;
      if (controller.tree.root.board.some((c, i) => c !== game.board[i])) return;
      const move = decision.move;
      setPendingAiMove(move);
      aiTimer.current = setTimeout(() => {
        aiTimer.current = null;
        setPendingAiMove(null);
        loadPosition(applyMove(game, move), 'Nova posição após a jogada da IA: árvore reinicializada.', { keepTree: true });
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

  // ---------- game actions ----------

  const playCell = (cell: Move) => {
    if (mode === 'analysis') {
      if (analysisTool === 'edit') {
        const order: Cell[] = [null, 'X', 'O'];
        const board = game.board.slice();
        board[cell] = order[(order.indexOf(board[cell]) + 1) % 3];
        loadPosition(gameFromBoard(board, game.toMove), 'Posição editada: árvore reinicializada.');
        return;
      }
      if (!isLegalMove(game.board, cell)) return;
      loadPosition(applyMove(game, cell), 'Jogada aplicada na análise: árvore reinicializada.');
      return;
    }
    if (mode !== 'pva' || game.toMove !== humanPlayer || game.outcome !== null || !isLegalMove(game.board, cell)) return;
    if (controller.status === 'running') controller.cancel();
    loadPosition(applyMove(game, cell), 'Nova posição após a sua jogada: árvore reinicializada.');
  };

  const newGame = () => loadPosition(createGame(starter), 'Nova partida: árvore reinicializada.');

  const setMode = (m: GameMode) => {
    if (m === mode) return;
    setModeState(m);
    if (m === 'analysis') {
      loadPosition(gameFromBoard(game.board, game.toMove), 'Modo de análise: árvore reinicializada.', { mode: m });
    } else {
      loadPosition(createGame(starter), 'Novo modo de jogo: árvore reinicializada.', { mode: m });
    }
  };

  const setHumanPlayer = (p: Player) => {
    setHumanPlayerState(p);
    if (mode === 'pva') loadPosition(createGame(starter), 'Troca de lado: nova partida.', { human: p });
  };

  const setStarter = (p: Player) => {
    setStarterState(p);
    if (mode !== 'analysis') loadPosition(createGame(p), 'Novo jogador inicial: nova partida.');
  };

  const setAnalysisToMove = (p: Player) => {
    if (mode !== 'analysis' || p === game.toMove) return;
    loadPosition(gameFromBoard(game.board, p), 'Turno alterado: árvore reinicializada.');
  };

  const clearAnalysisBoard = () =>
    loadPosition(gameFromBoard(Array<Cell>(9).fill(null), game.toMove), 'Tabuleiro limpo: árvore reinicializada.');

  /** Plays the move chosen by the finished search (analysis, or manual play when auto-play is off). */
  const applyDecision = () => {
    const d = controller.decision;
    if (!d || d.move === null || game.outcome !== null) return;
    if (controller.tree.root.board.some((c, i) => c !== game.board[i])) return;
    if (mode === 'pva' && game.toMove === humanPlayer) return;
    loadPosition(applyMove(game, d.move), 'Jogada sugerida aplicada: árvore reinicializada.');
  };

  const resetSearch = () => {
    clearAiTimer();
    controller.reset(game.board, game.toMove, configs[game.toMove], 'Busca reiniciada pelo usuário (a partida foi mantida).');
  };

  // ---------- search configuration ----------

  /** Player whose AI settings are being edited. */
  const editingPlayer: Player = mode === 'pva' ? otherPlayer(humanPlayer) : mode === 'ava' ? avaEditing : game.toMove;

  const updateConfig = (partial: Partial<MCTSConfig>) => {
    const next = { ...configs, [editingPlayer]: { ...configs[editingPlayer], ...partial } };
    setConfigs(next);
    if (controller.tree.rootPlayer === editingPlayer) controller.updateConfig(partial);
  };

  const setSpeed = (s: AnimationSpeed) => controller.setSpeed(s);
  const setDetailed = (d: boolean) => controller.setDetailed(d);

  const decision = controller.decision;
  const rootMatchesGame = controller.tree.root.board.every((c, i) => c === game.board[i]) && controller.tree.rootPlayer === game.toMove;
  /** A finished search whose move can be played by hand (analysis, or AI turn with auto-play off). */
  const canApplyDecision =
    decision !== null &&
    decision.move !== null &&
    game.outcome === null &&
    rootMatchesGame &&
    pendingAiMove === null &&
    (mode === 'analysis' || (isAiTurn(game, mode, humanPlayer) && !autoPlay));

  const validation: PositionValidation | null = mode === 'analysis' ? validatePosition(game.board, game.toMove) : null;

  return {
    version,
    controller,
    mode,
    setMode,
    humanPlayer,
    setHumanPlayer,
    starter,
    setStarter,
    game,
    playCell,
    newGame,
    resetSearch,
    applyDecision,
    canApplyDecision,
    treeIsCurrent: rootMatchesGame,
    pendingAiMove,
    aiTurn: isAiTurn(game, mode, humanPlayer),
    autoPlay,
    setAutoPlay,
    analysisTool,
    setAnalysisTool,
    setAnalysisToMove,
    clearAnalysisBoard,
    validation,
    configs,
    editingPlayer,
    setAvaEditing,
    updateConfig,
    setSpeed,
    setDetailed,
  };
}

export type Lab = ReturnType<typeof useLab>;
