import { legalMoves, otherPlayer, outcomeOf, playOnBoard } from '../game/rules';
import type { Board, Outcome, Player } from '../game/types';
import { mulberry32 } from './rng';
import { simulate } from './rollout';
import type { Decision, MCTSConfig, OutcomeCounts, Rng, SearchEvent, SearchNode, SimulationResult } from './types';

export type Simulator = (board: Board, toMove: Player) => SimulationResult;

export interface TreeOptions {
  rng?: Rng;
  /** Replaces the rollout (used by tests to feed controlled results). */
  simulator?: Simulator;
}

/** Reward of `outcome` from the perspective of `player`: win 1, draw 0.5, loss 0. */
export function rewardFor(outcome: Outcome, player: Player): number {
  if (outcome === 'draw') return 0.5;
  return outcome === player ? 1 : 0;
}

/**
 * UCT of `child` as seen by its parent:
 *   W_i / N_i + C * sqrt(ln(N_p) / N_i)
 * W_i is the reward sum from the perspective of the player who moved into the child
 * (= the player choosing at the parent). Unvisited children are +Infinity.
 */
export function uctValue(child: SearchNode, parentVisits: number, exploration: number): number {
  if (child.visits === 0) return Infinity;
  const exploitation = child.totalReward / child.visits;
  const explorationTerm = exploration * Math.sqrt(Math.log(Math.max(parentVisits, 1)) / child.visits);
  return exploitation + explorationTerm;
}

export class MCTSTree {
  readonly root: SearchNode;
  readonly config: MCTSConfig;
  readonly rng: Rng;
  private readonly simulator: Simulator;
  private readonly nodes = new Map<number, SearchNode>();
  private nextId = 0;

  iterations = 0;
  maxDepth = 0;
  /** Totals of rollout results, by absolute winner. */
  readonly rolloutTotals: OutcomeCounts = { X: 0, O: 0, draw: 0 };

  constructor(board: Board, toMove: Player, config: MCTSConfig, options: TreeOptions = {}) {
    this.config = { ...config };
    this.rng = options.rng ?? mulberry32((Math.random() * 2 ** 32) >>> 0);
    this.simulator =
      options.simulator ?? ((b, p) => simulate(b, p, this.config.rolloutPolicy, this.rng));
    this.root = this.createNode(board.slice(), toMove, null, null);
  }

  get rootPlayer(): Player {
    return this.root.playerToMove;
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  getNode(id: number): SearchNode | undefined {
    return this.nodes.get(id);
  }

  allNodes(): IterableIterator<SearchNode> {
    return this.nodes.values();
  }

  pathTo(node: SearchNode): number[] {
    const path: number[] = [];
    for (let n: SearchNode | null = node; n; n = n.parent) path.push(n.id);
    return path.reverse();
  }

  private createNode(board: Board, toMove: Player, parent: SearchNode | null, move: number | null): SearchNode {
    const terminal = outcomeOf(board);
    const node: SearchNode = {
      id: this.nextId++,
      parent,
      children: [],
      board,
      playerToMove: toMove,
      playerJustMoved: otherPlayer(toMove),
      move,
      visits: 0,
      outcomes: { X: 0, O: 0, draw: 0 },
      totalReward: 0,
      untriedMoves: terminal === null ? legalMoves(board) : [],
      terminal,
      depth: parent ? parent.depth + 1 : 0,
    };
    this.nodes.set(node.id, node);
    if (node.depth > this.maxDepth) this.maxDepth = node.depth;
    return node;
  }

  uct(node: SearchNode): number | null {
    return node.parent ? uctValue(node, node.parent.visits, this.config.exploration) : null;
  }

  /** Child of `node` with the highest UCT (first one wins ties). */
  selectChild(node: SearchNode): SearchNode {
    let best = node.children[0];
    let bestValue = -Infinity;
    for (const child of node.children) {
      const value = uctValue(child, node.visits, this.config.exploration);
      if (value > bestValue) {
        best = child;
        bestValue = value;
      }
    }
    return best;
  }

  /** Expands one untried move of `node` into a new child. */
  expand(node: SearchNode): SearchNode {
    if (node.terminal !== null || node.untriedMoves.length === 0) {
      throw new Error(`Nó ${node.id} não pode ser expandido`);
    }
    const index = Math.floor(this.rng() * node.untriedMoves.length);
    const [move] = node.untriedMoves.splice(index, 1);
    const child = this.createNode(playOnBoard(node.board, move, node.playerToMove), otherPlayer(node.playerToMove), node, move);
    node.children.push(child);
    return child;
  }

  /** Runs one complete iteration, yielding an event after every real state change. */
  *iterate(): Generator<SearchEvent, Outcome> {
    const iteration = this.iterations + 1;

    // 1. Selection
    let node = this.root;
    const path = [node.id];
    while (node.terminal === null && node.untriedMoves.length === 0 && node.children.length > 0) {
      const parent = node;
      const candidates = parent.children.map((c) => ({
        nodeId: c.id,
        move: c.move as number,
        visits: c.visits,
        uct: uctValue(c, parent.visits, this.config.exploration),
      }));
      node = this.selectChild(parent);
      path.push(node.id);
      yield { type: 'selection', iteration, nodeId: parent.id, chosenId: node.id, move: node.move as number, candidates, path: [...path] };
    }
    yield {
      type: 'selection-end',
      iteration,
      nodeId: node.id,
      reason: node.terminal !== null ? 'terminal' : 'expandable',
      path: [...path],
    };

    // 2. Expansion
    if (node.terminal === null && node.untriedMoves.length > 0) {
      const parentId = node.id;
      node = this.expand(node);
      path.push(node.id);
      yield { type: 'expansion', iteration, nodeId: node.id, parentId, move: node.move as number, path: [...path] };
    }

    // 3. Simulation (a terminal node yields its exact result with no rollout moves)
    const result: SimulationResult =
      node.terminal !== null
        ? { outcome: node.terminal, moves: [], policy: this.config.rolloutPolicy }
        : this.simulator(node.board, node.playerToMove);
    this.rolloutTotals[result.outcome]++;
    yield { type: 'simulation', iteration, nodeId: node.id, result, path: [...path] };

    // 4. Backpropagation
    const updated: number[] = [];
    for (let n: SearchNode | null = node; n; n = n.parent) {
      const reward = this.updateNode(n, result.outcome);
      updated.push(n.id);
      yield {
        type: 'backpropagation',
        iteration,
        nodeId: n.id,
        outcome: result.outcome,
        reward,
        visitsAfter: n.visits,
        updated: [...updated],
        path: [...path],
      };
    }

    this.iterations = iteration;
    yield { type: 'iteration-complete', iteration, outcome: result.outcome, path: [...path] };
    return result.outcome;
  }

  /** Applies one result to a node; returns the reward added (from playerJustMoved's view). */
  updateNode(node: SearchNode, outcome: Outcome): number {
    const reward = rewardFor(outcome, node.playerJustMoved);
    node.visits++;
    node.outcomes[outcome]++;
    node.totalReward += reward;
    return reward;
  }

  /** Runs one iteration to completion and returns its events. */
  runIteration(): SearchEvent[] {
    return [...this.iterate()];
  }

  run(iterations: number): void {
    for (let i = 0; i < iterations; i++) {
      for (const _ of this.iterate()) void _;
    }
  }

  /**
   * Final move policy: the root child with the most visits ("robust child").
   * Ties are broken by mean reward, then by lowest cell index. UCT is NOT used here.
   */
  decide(): Decision {
    if (this.root.terminal !== null) return { move: null, reason: 'terminal', nodeId: null, visits: 0 };
    if (this.root.children.length === 0 && this.root.untriedMoves.length === 0) {
      return { move: null, reason: 'no-legal-moves', nodeId: null, visits: 0 };
    }
    if (this.iterations === 0 || this.root.children.length === 0) {
      return { move: null, reason: 'no-iterations', nodeId: null, visits: 0 };
    }
    let best = this.root.children[0];
    for (const c of this.root.children) {
      const better =
        c.visits > best.visits ||
        (c.visits === best.visits &&
          (c.totalReward / c.visits > best.totalReward / best.visits ||
            (c.totalReward / c.visits === best.totalReward / best.visits && (c.move as number) < (best.move as number))));
      if (better) best = c;
    }
    return { move: best.move, reason: 'most-visits', nodeId: best.id, visits: best.visits };
  }
}
