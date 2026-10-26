import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../mcts/rng';
import { MCTSTree } from '../mcts/tree';
import { DEFAULT_CONFIG } from '../mcts/types';
import { layoutTree, principalVariation } from '../visualization/layout';
import { toNodeView } from '../visualization/nodeView';
import { b } from './helpers';

const grown = () => {
  const tree = new MCTSTree(b('.........'), 'X', { ...DEFAULT_CONFIG }, { rng: mulberry32(12) });
  tree.run(400);
  return tree;
};

describe('tree layout', () => {
  it('shows only the root when nothing is expanded', () => {
    const tree = grown();
    const l = layoutTree(tree.root, { expanded: new Set(), showStats: true, maxNodes: 100 });
    expect(l.nodes).toHaveLength(1);
    expect(l.nodes[0].hiddenChildren).toBe(9);
  });

  it('lays out expanded children ordered by cell, parent centred', () => {
    const tree = grown();
    const l = layoutTree(tree.root, { expanded: new Set([tree.root.id]), showStats: true, maxNodes: 100 });
    expect(l.nodes).toHaveLength(10);
    expect(l.edges).toHaveLength(9);
    const kids = l.nodes.filter((n) => n.node.depth === 1).sort((a, c) => a.x - c.x);
    expect(kids.map((k) => k.node.move)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const root = l.byId.get(tree.root.id)!;
    expect(root.x).toBeCloseTo((kids[0].x + kids[8].x) / 2);
    expect(kids.every((k) => k.y > root.y)).toBe(true);
  });

  it('limits rendered nodes without touching the search tree', () => {
    const tree = grown();
    const all = new Set([...tree.allNodes()].map((n) => n.id));
    const before = tree.nodeCount;
    const l = layoutTree(tree.root, { expanded: all, showStats: false, maxNodes: 25 });
    expect(l.nodes.length).toBeLessThanOrEqual(25);
    expect(l.truncated).toBeGreaterThan(0);
    expect(tree.nodeCount).toBe(before);
  });
});

describe('node view', () => {
  it('is serializable (no circular references) and carries the move line', () => {
    const tree = grown();
    const pv = principalVariation(tree.root);
    const leaf = pv[pv.length - 1];
    const view = toNodeView(leaf, 'X', DEFAULT_CONFIG.exploration);
    expect(() => JSON.stringify(view)).not.toThrow();
    expect(view.line).toHaveLength(leaf.depth);
    expect(view.stats.visits).toBe(leaf.visits);
  });

  it('follows the most visited children', () => {
    const tree = grown();
    const pv = principalVariation(tree.root);
    expect(pv[1].visits).toBe(Math.max(...tree.root.children.map((c) => c.visits)));
  });
});
