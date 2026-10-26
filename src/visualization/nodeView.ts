import { moveLabel } from '../game/rules';
import type { Cell, Move, Player } from '../game/types';
import { nodeStatistics } from '../mcts/statistics';
import type { NodeStatistics, SearchNode } from '../mcts/types';

/** Serializable, non-circular projection of a SearchNode for the UI. */
export interface NodeView {
  id: number;
  parentId: number | null;
  move: Move | null;
  moveLabel: string | null;
  board: Cell[];
  playerToMove: Player;
  playerJustMoved: Player;
  depth: number;
  childIds: number[];
  untriedMoves: Move[];
  /** Moves from the root to this node, e.g. ["B2", "A1"]. */
  line: string[];
  stats: NodeStatistics;
  /** UCT split into its two terms (parent chooser's perspective). */
  uctTerms: { exploitation: number; exploration: number } | null;
}

export function toNodeView(node: SearchNode, perspective: Player, exploration: number): NodeView {
  const line: string[] = [];
  for (let n: SearchNode | null = node; n && n.move !== null; n = n.parent) line.unshift(moveLabel(n.move));
  const parent = node.parent;
  return {
    id: node.id,
    parentId: parent ? parent.id : null,
    move: node.move,
    moveLabel: node.move === null ? null : moveLabel(node.move),
    board: node.board.slice(),
    playerToMove: node.playerToMove,
    playerJustMoved: node.playerJustMoved,
    depth: node.depth,
    childIds: node.children.map((c) => c.id),
    untriedMoves: [...node.untriedMoves],
    line,
    stats: nodeStatistics(node, perspective, exploration),
    uctTerms:
      parent && node.visits > 0
        ? {
            exploitation: node.totalReward / node.visits,
            exploration: exploration * Math.sqrt(Math.log(Math.max(parent.visits, 1)) / node.visits),
          }
        : null,
  };
}
