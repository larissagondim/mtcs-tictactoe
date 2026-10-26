import type { SearchNode } from '../mcts/types';

export interface LayoutOptions {
  /** Ids whose children are shown. */
  expanded: ReadonlySet<number>;
  showStats: boolean;
  /** Visual limit; hidden nodes still exist in the search tree. */
  maxNodes: number;
}

export interface LayoutNode {
  node: SearchNode;
  x: number;
  y: number;
  /** Children not drawn (collapsed or over the display limit). */
  hiddenChildren: number;
  expanded: boolean;
}

export interface LayoutEdge {
  from: LayoutNode;
  to: LayoutNode;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  byId: Map<number, LayoutNode>;
  width: number;
  height: number;
  nodeW: number;
  nodeH: number;
  /** Nodes left out only because of `maxNodes`. */
  truncated: number;
}

export const NODE_SIZE = {
  full: { w: 128, h: 78 },
  compact: { w: 64, h: 64 },
};
const GAP_X = 14;
const GAP_Y = 64;
const PAD = 24;

const byMove = (a: SearchNode, b: SearchNode) => (a.move as number) - (b.move as number);

/**
 * Simple tidy layout: leaves take consecutive slots, parents are centred
 * over their visible children. Children are ordered by cell index so a node
 * keeps its place while the search grows the tree.
 */
export function layoutTree(root: SearchNode, { expanded, showStats, maxNodes }: LayoutOptions): TreeLayout {
  const { w: nodeW, h: nodeH } = showStats ? NODE_SIZE.full : NODE_SIZE.compact;

  // Breadth-first so the display limit cuts the deepest levels first.
  const visibleChildren = new Map<number, SearchNode[]>();
  let count = 1;
  let truncated = 0;
  const queue: SearchNode[] = [root];
  while (queue.length) {
    const n = queue.shift()!;
    if (!expanded.has(n.id) || n.children.length === 0) continue;
    const kids = [...n.children].sort(byMove);
    const room = Math.max(0, maxNodes - count);
    const shown = kids.slice(0, room);
    truncated += kids.length - shown.length;
    count += shown.length;
    visibleChildren.set(n.id, shown);
    queue.push(...shown);
  }

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const byId = new Map<number, LayoutNode>();
  let nextSlot = 0;
  let maxDepth = 0;

  const place = (n: SearchNode, depth: number): LayoutNode => {
    const kids = visibleChildren.get(n.id) ?? [];
    const y = PAD + depth * (nodeH + GAP_Y);
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    const placedKids = kids.map((k) => place(k, depth + 1));
    if (placedKids.length) {
      x = (placedKids[0].x + placedKids[placedKids.length - 1].x) / 2;
    } else {
      x = PAD + nextSlot++ * (nodeW + GAP_X);
    }
    const ln: LayoutNode = {
      node: n,
      x,
      y,
      hiddenChildren: n.children.length - kids.length,
      expanded: kids.length > 0,
    };
    nodes.push(ln);
    byId.set(n.id, ln);
    for (const k of placedKids) edges.push({ from: ln, to: k });
    return ln;
  };
  place(root, 0);

  return {
    nodes,
    edges,
    byId,
    width: PAD * 2 + Math.max(1, nextSlot) * (nodeW + GAP_X) - GAP_X,
    height: PAD * 2 + (maxDepth + 1) * (nodeH + GAP_Y) - GAP_Y,
    nodeW,
    nodeH,
    truncated,
  };
}

/** Most-visited line from `from` (the principal variation). */
export function principalVariation(from: SearchNode): SearchNode[] {
  const line = [from];
  let n = from;
  while (n.children.length) {
    n = n.children.reduce((best, c) => (c.visits > best.visits ? c : best));
    if (n.visits === 0) break;
    line.push(n);
  }
  return line;
}
