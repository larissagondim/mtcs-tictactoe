import { House, Maximize2, Network, Route, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { pct } from '../components/format';
import { moveLabel } from '../game/rules';
import type { TreeUi } from '../hooks/useTreeUi';
import type { SearchController } from '../mcts/controller';
import { uctValue, type MCTSTree } from '../mcts/tree';
import type { SearchNode } from '../mcts/types';
import { layoutTree, principalVariation, type LayoutNode } from './layout';
import { TreeNodeGlyph, type GlyphData } from './TreeNodeGlyph';

const MAX_RENDERED_NODES = 400;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.2;
const LOD_ZOOM = 0.55;

interface View {
  x: number;
  y: number;
  k: number;
}

export function TreeView({ controller: c, ui, stale }: { controller: SearchController; ui: TreeUi; stale: boolean }) {
  const tree = c.tree;
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  // The tree always follows the search and shows statistics on each node.
  const showStats = true;
  const follow = true;
  const [viewState, setViewState] = useState<{ tree: MCTSTree; view: View } | null>(null);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  // Nodes on the active path are shown when "follow" is on.
  const activity = c.activity;
  const visibleExpanded = new Set(ui.expanded);
  const searching = c.status === 'running' || c.status === 'paused';
  if (follow && searching) {
    for (const id of activity.path.slice(0, -1)) visibleExpanded.add(id);
    const ancestorsOfSelection = ancestors(ui.selectedNode);
    for (const n of ancestorsOfSelection) visibleExpanded.add(n.id);
  }
  const layout = layoutTree(tree.root, { expanded: visibleExpanded, showStats, maxNodes: MAX_RENDERED_NODES });
  const rootPos = layout.byId.get(tree.root.id)!;

  /** Until the user pans or zooms, the view keeps the whole visible tree framed. */
  const initialView = (): View => {
    const k = clamp(Math.min((size.w - 24) / layout.width, (size.h - 40) / layout.height, 0.9), 0.4, 0.9);
    const x = layout.width * k <= size.w ? (size.w - layout.width * k) / 2 : size.w / 2 - rootPos.x * k;
    return { x, y: 14, k };
  };
  const view = viewState?.tree === tree ? viewState.view : initialView();
  const setView = (fn: (v: View) => View) => setViewState({ tree, view: fn(view) });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  const zoomAtRef = useRef<(factor: number, cx: number, cy: number) => void>(() => {});
  useEffect(() => {
    zoomAtRef.current = (factor, cx, cy) =>
      setViewState({ tree, view: zoomAt(view, factor, cx, cy) });
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAtRef.current(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.tnode')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.px, y: d.vy + e.clientY - d.py }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const fit = () => {
    const k = clamp(Math.min((size.w - 24) / layout.width, (size.h - 24) / layout.height, 1.2), MIN_ZOOM, MAX_ZOOM);
    setView(() => ({ k, x: (size.w - layout.width * k) / 2, y: 12 }));
  };

  const centerOn = (ln: LayoutNode | undefined, k = view.k) => {
    if (!ln) return;
    setView(() => ({ k, x: size.w / 2 - ln.x * k, y: size.h / 3 - ln.y * k }));
  };

  const goRoot = () => {
    ui.collapseToRoot();
    ui.select(tree.root);
    setViewState({ tree, view: initialView() });
  };

  /** Reveals the chosen move (or current best) and its most-visited continuation. */
  const locateChosen = () => {
    const decided = c.decision?.nodeId != null ? tree.getNode(c.decision.nodeId) : undefined;
    const first = decided ?? principalVariation(tree.root)[1];
    if (!first) return;
    const line = principalVariation(first);
    ui.reveal(line);
    ui.select(first);
    const k = Math.max(view.k, 0.7);
    // Position is known after re-layout; approximate with the current layout when visible.
    const ln = layout.byId.get(first.id);
    if (ln) centerOn(ln, k);
  };

  // ---------- highlighting ----------
  const pathSet = new Set(activity.path);
  const backprop = activity.phase === 'backpropagation' ? new Set(activity.backpropIds) : new Set<number>();
  const decisionId = c.decision?.nodeId ?? null;
  const decisionPath = new Set(decisionId !== null ? [tree.root.id, decisionId] : []);
  const selectedId = ui.selectedNode.id;

  const classFor = (n: SearchNode) => {
    const cls: string[] = [];
    if (pathSet.has(n.id) && activity.phase !== 'idle') cls.push('is-path');
    if (activity.expandedNodeId === n.id && activity.phase !== 'idle') cls.push('is-new');
    if (activity.phase === 'simulation' && activity.simulation?.nodeId === n.id) cls.push('is-sim');
    if (backprop.has(n.id)) cls.push('is-backprop');
    if (activity.currentNodeId === n.id) cls.push('is-current');
    if (n.id === selectedId) cls.push('is-selected');
    if (decisionPath.has(n.id) && n.parent) cls.push('is-decision');
    if (n.terminal) cls.push('is-terminal');
    return cls.join(' ');
  };

  // ---------- culling ----------
  const margin = 80;
  const vx0 = -view.x / view.k - margin;
  const vy0 = -view.y / view.k - margin;
  const vx1 = vx0 + size.w / view.k + 2 * margin;
  const vy1 = vy0 + size.h / view.k + 2 * margin;
  const inView = (ln: LayoutNode) => ln.x + layout.nodeW / 2 >= vx0 && ln.x - layout.nodeW / 2 <= vx1 && ln.y + layout.nodeH >= vy0 && ln.y <= vy1;
  const drawnNodes = layout.nodes.filter(inView);
  const drawnEdges = layout.edges.filter((e) => inView(e.from) || inView(e.to));
  const mode = !showStats ? 'compact' : view.k < LOD_ZOOM ? 'lod' : 'full';
  const perspective = tree.rootPlayer;
  const rootVisits = Math.max(1, tree.root.visits);

  // Stable callbacks so memoised node glyphs only re-render when their data changes.
  const latest = useRef({ tree, ui });
  useEffect(() => {
    latest.current = { tree, ui };
  });
  const [handlers] = useState(() => ({
    select: (id: number) => {
      const n = latest.current.tree.getNode(id);
      if (n) latest.current.ui.select(n);
    },
    toggle: (id: number) => {
      const n = latest.current.tree.getNode(id);
      if (n) latest.current.ui.toggle(n);
    },
  }));


  return (
    <section className="panel tree-panel" aria-labelledby="tree-title">
      <header className="panel__header">
        <h2 id="tree-title">
          <Network size={16} aria-hidden /> Árvore de busca
        </h2>
        <div className="toolbar" role="toolbar" aria-label="Controles da árvore">
          <button type="button" className="btn btn--icon" onClick={() => zoomAtRef.current(1 / 1.25, size.w / 2, size.h / 2)} title="Afastar" aria-label="Afastar">
            <ZoomOut size={16} />
          </button>
          <button type="button" className="btn btn--icon" onClick={() => zoomAtRef.current(1.25, size.w / 2, size.h / 2)} title="Aproximar" aria-label="Aproximar">
            <ZoomIn size={16} />
          </button>
          <button type="button" className="btn btn--icon" onClick={fit} title="Enquadrar tudo" aria-label="Enquadrar tudo">
            <Maximize2 size={16} />
          </button>
          <button type="button" className="btn btn--icon" onClick={goRoot} title="Voltar à raiz" aria-label="Voltar à raiz">
            <House size={16} />
          </button>
          <button type="button" className="btn btn--small" onClick={locateChosen} disabled={tree.root.children.length === 0} title="Mostra o caminho da jogada escolhida pela IA (ou da melhor até agora)">
            <Route size={15} aria-hidden /> Ver jogada escolhida
          </button>
        </div>
      </header>

      {stale && <p className="stale-note">Esta é a árvore que a IA usou para decidir a última jogada.</p>}

      <div className="tree-canvas" ref={containerRef}>
        <svg
          width="100%"
          height="100%"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="tree"
          aria-label="Árvore MCTS"
        >
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" className="hatch-bg" />
              <line x1="0" y1="0" x2="0" y2="6" className="hatch-line" />
            </pattern>
          </defs>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {drawnEdges.map(({ from, to }) => {
              const x1 = from.x;
              const y1 = from.y + layout.nodeH + (from.node.children.length ? 17 : 0);
              const x2 = to.x;
              const y2 = to.y;
              const my = (y1 + y2) / 2;
              const onPath = pathSet.has(to.node.id) && activity.phase !== 'idle';
              const onBackprop = backprop.has(to.node.id);
              const cls = onBackprop ? 'edge is-backprop' : onPath ? 'edge is-path' : decisionPath.has(to.node.id) && from.node === tree.root ? 'edge is-decision' : 'edge';
              return (
                <path
                  key={to.node.id}
                  className={cls}
                  d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                  strokeWidth={1 + 4 * Math.sqrt(to.node.visits / rootVisits)}
                />
              );
            })}
            {drawnNodes.map((ln) => (
              <TreeNodeGlyph
                key={ln.node.id}
                d={glyphData(ln, perspective, c.config.exploration)}
                x={ln.x}
                y={ln.y}
                w={layout.nodeW}
                h={layout.nodeH}
                mode={mode}
                classes={classFor(ln.node)}
                onSelect={handlers.select}
                onToggle={handlers.toggle}
              />
            ))}
          </g>
        </svg>
        <div className="tree-legend" aria-hidden>
          <span>Chances da IA:</span>
          <span className="lg lg--win">vitória</span>
          <span className="lg lg--draw">empate</span>
          <span className="lg lg--loss">derrota</span>
          <span className="lg lg--path">caminho atual</span>
          <span className="lg lg--dec">jogada escolhida</span>
        </div>
      </div>

      <footer className="tree-footer">
        <p className="node-summary">{summarize(ui.selectedNode, perspective)}</p>
        <span className="muted small">
          Clique em um nó para ver suas chances · arraste para mover · role para aproximar
          {layout.truncated > 0 && ' · alguns nós estão ocultos para não poluir a tela'}
        </span>
      </footer>
    </section>
  );
}

function glyphData(ln: LayoutNode, perspective: 'X' | 'O', exploration: number): GlyphData {
  const n = ln.node;
  const v = n.visits;
  return {
    id: n.id,
    board: n.board,
    move: n.move,
    playerJustMoved: n.playerJustMoved,
    visits: v,
    winRate: v ? n.outcomes[perspective] / v : null,
    drawRate: v ? n.outcomes.draw / v : null,
    lossRate: v ? n.outcomes[perspective === 'X' ? 'O' : 'X'] / v : null,
    uct: n.parent ? uctValue(n, n.parent.visits, exploration) : null,
    terminal: n.terminal,
    perspective,
    hasChildren: n.children.length > 0,
    expanded: ln.expanded,
    hiddenChildren: ln.hiddenChildren,
  };
}

function ancestors(n: SearchNode): SearchNode[] {
  const out: SearchNode[] = [];
  for (let p = n.parent; p; p = p.parent) out.push(p);
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function zoomAt(v: View, factor: number, cx: number, cy: number): View {
  const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
  const f = k / v.k;
  return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
}

/** One plain sentence about a node, from its real counts (AI = root player). */
function summarize(n: SearchNode, ai: 'X' | 'O'): string {
  const head =
    n.move === null ? 'Posição analisada' : `${n.playerJustMoved === ai ? 'A IA joga' : 'Você joga'} em ${moveLabel(n.move)}`;
  if (n.terminal) return `${head}: fim de jogo — ${n.terminal === 'draw' ? 'empate' : n.terminal === ai ? 'a IA vence' : 'a IA perde'}.`;
  if (n.visits === 0) return `${head}: ainda não foi analisado.`;
  const v = n.visits;
  return `${head}: ${v} ${v === 1 ? 'partida simulada' : 'partidas simuladas'} — a IA venceu ${pct(n.outcomes[ai] / v, 0)}, empatou ${pct(
    n.outcomes.draw / v,
    0,
  )} e perdeu ${pct((v - n.outcomes[ai] - n.outcomes.draw) / v, 0)}.`;
}
