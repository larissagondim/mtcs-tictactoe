import type { Board, Move, Outcome, Player } from '../game/types';

export type RolloutPolicy = 'random' | 'heuristic';
/** Returns a float in [0, 1). Injectable so tests can be deterministic. */
export type Rng = () => number;

export interface MCTSConfig {
  /** Maximum number of iterations (selection → backpropagation cycles). */
  iterations: number;
  /** Exploration constant C of the UCT formula. */
  exploration: number;
  rolloutPolicy: RolloutPolicy;
}

export const DEFAULT_CONFIG: MCTSConfig = {
  iterations: 1000,
  exploration: Math.SQRT2,
  rolloutPolicy: 'random',
};

/** Raw counts of observed results, always stored by absolute winner. */
export interface OutcomeCounts {
  X: number;
  O: number;
  draw: number;
}

export interface SearchNode {
  id: number;
  parent: SearchNode | null;
  children: SearchNode[];
  board: Board;
  /** Player who makes the next move from this node. */
  playerToMove: Player;
  /** Player who made `move` (the opponent of `playerToMove`). */
  playerJustMoved: Player;
  /** Move that led here from the parent; null for the root. */
  move: Move | null;
  visits: number;
  /** Rollout results backpropagated through this node. */
  outcomes: OutcomeCounts;
  /**
   * Sum of rewards from the perspective of `playerJustMoved`
   * (win = 1, draw = 0.5, loss = 0). This is what the parent maximises in UCT.
   */
  totalReward: number;
  /** Legal moves that have not been expanded into children yet. */
  untriedMoves: Move[];
  /** Exact result if the board is terminal, otherwise null. */
  terminal: Outcome | null;
  depth: number;
}

export interface SimulationResult {
  outcome: Outcome;
  /** Moves played during the rollout, in order. */
  moves: { move: Move; player: Player }[];
  policy: RolloutPolicy;
}

/** Statistics from the perspective of one player (normally the root player). */
export interface NodeStatistics {
  perspective: Player;
  visits: number;
  wins: number;
  draws: number;
  losses: number;
  /** null when the node was never visited: "Não estimada". */
  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;
  /** Mean reward (win 1, draw 0.5) for the perspective player; not a probability. */
  meanReward: number | null;
  /** 95% Wilson interval for the win rate, null when unvisited. */
  winInterval: [number, number] | null;
  /** UCT value relative to the parent, null for the root; Infinity when unvisited. */
  uct: number | null;
  lowSample: boolean;
  /** Exact result if the node is a terminal state. */
  terminal: Outcome | null;
}

export type SearchPhase = 'selection' | 'expansion' | 'simulation' | 'backpropagation';

export interface UctCandidate {
  nodeId: number;
  move: Move;
  visits: number;
  uct: number;
}

export type SearchEvent =
  | {
      type: 'selection';
      iteration: number;
      /** Node whose children were compared. */
      nodeId: number;
      /** Child chosen by UCT. */
      chosenId: number;
      move: Move;
      candidates: UctCandidate[];
      path: number[];
    }
  | {
      /** Selection stopped: the node is expandable or terminal. */
      type: 'selection-end';
      iteration: number;
      nodeId: number;
      reason: 'expandable' | 'terminal';
      path: number[];
    }
  | { type: 'expansion'; iteration: number; nodeId: number; parentId: number; move: Move; path: number[] }
  | { type: 'simulation'; iteration: number; nodeId: number; result: SimulationResult; path: number[] }
  | {
      type: 'backpropagation';
      iteration: number;
      nodeId: number;
      outcome: Outcome;
      /** Reward added to this node from the perspective of its playerJustMoved. */
      reward: number;
      visitsAfter: number;
      /** Ids updated so far in this backpropagation, leaf first. */
      updated: number[];
      path: number[];
    }
  | { type: 'iteration-complete'; iteration: number; outcome: Outcome; path: number[] };

export type DecisionReason = 'most-visits' | 'no-iterations' | 'terminal' | 'no-legal-moves';

export interface Decision {
  move: Move | null;
  reason: DecisionReason;
  nodeId: number | null;
  visits: number;
}
