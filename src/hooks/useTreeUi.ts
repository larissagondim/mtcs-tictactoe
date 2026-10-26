import { useState } from 'react';
import type { MCTSTree } from '../mcts/tree';
import type { SearchNode } from '../mcts/types';

interface Keyed<T> {
  tree: MCTSTree;
  value: T;
}

/**
 * UI state of the tree view, keyed by tree instance so that a search reset
 * (which creates a new tree with fresh node ids) falls back to defaults.
 */
export function useTreeUi(tree: MCTSTree) {
  const [selection, setSelection] = useState<Keyed<number> | null>(null);
  const [expandedState, setExpandedState] = useState<Keyed<ReadonlySet<number>> | null>(null);

  const selectedNode: SearchNode =
    (selection?.tree === tree ? tree.getNode(selection.value) : undefined) ?? tree.root;
  const expanded: ReadonlySet<number> = expandedState?.tree === tree ? expandedState.value : new Set([tree.root.id]);

  const select = (node: SearchNode) => setSelection({ tree, value: node.id });

  const setExpanded = (fn: (prev: Set<number>) => void) => {
    const next = new Set(expanded);
    fn(next);
    setExpandedState({ tree, value: next });
  };

  const toggle = (node: SearchNode) =>
    setExpanded((s) => {
      if (s.has(node.id)) s.delete(node.id);
      else s.add(node.id);
    });

  /** Makes every node of `path` visible (expands all its ancestors). */
  const reveal = (path: SearchNode[]) =>
    setExpanded((s) => {
      for (const n of path) if (n.parent) s.add(n.parent.id);
    });

  const collapseToRoot = () => setExpandedState({ tree, value: new Set([tree.root.id]) });

  return { selectedNode, select, expanded, toggle, reveal, collapseToRoot };
}

export type TreeUi = ReturnType<typeof useTreeUi>;
