import { memo } from 'react';
import { MiniBoard } from '../components/Board';
import { pct } from '../components/format';
import { moveLabel } from '../game/rules';
import type { Cell, Outcome, Player } from '../game/types';

/** Plain values only, so memo() can skip unchanged nodes during fast searches. */
export interface GlyphData {
  id: number;
  board: readonly Cell[];
  move: number | null;
  playerJustMoved: Player;
  visits: number;
  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;
  uct: number | null;
  terminal: Outcome | null;
  perspective: Player;
  hasChildren: boolean;
  expanded: boolean;
  hiddenChildren: number;
}

interface GlyphProps {
  d: GlyphData;
  x: number;
  y: number;
  w: number;
  h: number;
  mode: 'full' | 'lod' | 'compact';
  classes: string;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
}

const terminalText = (t: Outcome) => (t === 'draw' ? 'Final: empate' : `Final: ${t} vence`);

export const TreeNodeGlyph = memo(function TreeNodeGlyph({ d, x, y, w, h, mode, classes, onSelect, onToggle }: GlyphProps) {
  const label = d.move === null ? 'Raiz' : `${d.playerJustMoved} ${moveLabel(d.move)}`;
  const estimated = d.winRate !== null;
  const title =
    `${label} — N=${d.visits}` +
    (estimated ? `, V ${pct(d.winRate)} E ${pct(d.drawRate)} D ${pct(d.lossRate)} (perspectiva de ${d.perspective})` : ', não estimada') +
    
    (d.terminal ? `, ${terminalText(d.terminal)} (exato)` : '');

  return (
    <g
      className={`tnode ${classes}`}
      transform={`translate(${x - w / 2},${y})`}
      onClick={() => onSelect(d.id)}
      role="button"
      tabIndex={0}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(d.id);
        }
      }}
    >
      <title>{title}</title>
      <rect className="tnode__box" width={w} height={h} rx={8} />
      {mode === 'compact' && (
        <>
          <MiniBoard board={d.board} size={40} x={(w - 40) / 2} y={6} highlight={d.move} />
          <text className="tnode__move" x={w / 2} y={h - 8} textAnchor="middle">
            {label}
          </text>
        </>
      )}
      {mode === 'lod' && (
        <>
          <text className={`tnode__big ${estimated ? '' : 'is-na'}`} x={w / 2} y={h / 2 - 2} textAnchor="middle">
            {estimated ? pct(d.winRate, 0) : 'n/e'}
          </text>
          <text className="tnode__meta" x={w / 2} y={h / 2 + 18} textAnchor="middle">
            N {d.visits}
          </text>
        </>
      )}
      {mode === 'full' && (
        <>
          <MiniBoard board={d.board} size={40} x={6} y={6} highlight={d.move} />
          <text className="tnode__move" x={53} y={17}>
            {label}
          </text>
          <text className="tnode__meta" x={53} y={30}>
            N {d.visits}
          </text>

          {d.terminal && (
            <rect className={`tnode__term tnode__term--${d.terminal === 'draw' ? 'draw' : d.terminal === d.perspective ? 'win' : 'loss'}`} x={w - 14} y={6} width={8} height={8} rx={2} />
          )}
          {estimated ? (
            <g transform={`translate(6,52)`}>
              <rect className="tbar tbar--win" width={(w - 12) * d.winRate!} height={6} />
              <rect className="tbar tbar--draw" x={(w - 12) * d.winRate!} width={(w - 12) * d.drawRate!} height={6} />
              <rect className="tbar tbar--loss" x={(w - 12) * (d.winRate! + d.drawRate!)} width={(w - 12) * d.lossRate!} height={6} />
            </g>
          ) : (
            <rect className="tbar tbar--na" x={6} y={52} width={w - 12} height={6} />
          )}
          <text className="tnode__stats" x={6} y={71}>
            {d.terminal
              ? terminalText(d.terminal)
              : estimated
                ? `V ${pct(d.winRate, 0)} · E ${pct(d.drawRate, 0)} · D ${pct(d.lossRate, 0)}`
                : 'Não estimada'}
          </text>
        </>
      )}
      {d.hasChildren && (
        <g
          className="tnode__toggle"
          transform={`translate(${w / 2},${h + 9})`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(d.id);
          }}
          role="button"
          aria-label={d.expanded ? 'Recolher subárvore' : `Expandir subárvore (${d.hiddenChildren} filhos)`}
        >
          <circle r={8} />
          <text textAnchor="middle" dominantBaseline="central">
            {d.expanded ? '−' : '+'}
          </text>
          {d.hiddenChildren > 0 && (
            <text className="tnode__hidden" x={12} dominantBaseline="central">
              {d.hiddenChildren}
            </text>
          )}
        </g>
      )}
    </g>
  );
}, sameGlyph);

function sameGlyph(a: GlyphProps, b: GlyphProps): boolean {
  if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || a.mode !== b.mode || a.classes !== b.classes) return false;
  if (a.onSelect !== b.onSelect || a.onToggle !== b.onToggle) return false;
  const ka = Object.keys(a.d) as (keyof GlyphData)[];
  return ka.every((k) => a.d[k] === b.d[k]);
}
