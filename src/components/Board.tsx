import { moveLabel } from '../game/rules';
import type { Board as BoardType, Move } from '../game/types';

interface BoardProps {
  board: BoardType;
  winningLine: readonly number[] | null;
  lastMove: Move | null;
  /** Cell about to be played by the AI. */
  pendingMove?: Move | null;
  disabled?: boolean;
  editing?: boolean;
  onCell: (cell: Move) => void;
}

export function Board({ board, winningLine, lastMove, pendingMove = null, disabled, editing, onCell }: BoardProps) {
  return (
    <div className={`board${editing ? ' board--editing' : ''}`} role="grid" aria-label="Tabuleiro do jogo da velha">
      {board.map((cell, i) => {
        const classes = ['cell'];
        if (cell) classes.push(`cell--${cell.toLowerCase()}`);
        if (winningLine?.includes(i)) classes.push('cell--win');
        if (lastMove === i) classes.push('cell--last');
        if (pendingMove === i) classes.push('cell--pending');
        const playable = !disabled && (editing || cell === null);
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={classes.join(' ')}
            disabled={!playable}
            aria-label={`${moveLabel(i)}: ${cell ?? 'vazia'}`}
            onClick={() => onCell(i)}
          >
            {cell}
            <span className="cell__coord" aria-hidden>
              {moveLabel(i)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface MiniBoardProps {
  board: readonly (string | null)[];
  size: number;
  highlight?: number | null;
  x?: number;
  y?: number;
}

/** SVG thumbnail of a board, used inside tree nodes and panels. */
export function MiniBoard({ board, size, highlight = null, x = 0, y = 0 }: MiniBoardProps) {
  const c = size / 3;
  return (
    <g transform={`translate(${x},${y})`} className="mini-board">
      <rect width={size} height={size} rx={3} className="mini-board__bg" />
      {[1, 2].map((k) => (
        <g key={k} className="mini-board__grid">
          <line x1={k * c} y1={2} x2={k * c} y2={size - 2} />
          <line x1={2} y1={k * c} x2={size - 2} y2={k * c} />
        </g>
      ))}
      {highlight !== null && (
        <rect x={(highlight % 3) * c + 1} y={Math.floor(highlight / 3) * c + 1} width={c - 2} height={c - 2} rx={2} className="mini-board__last" />
      )}
      {board.map((v, i) =>
        v ? (
          <text
            key={i}
            x={(i % 3) * c + c / 2}
            y={Math.floor(i / 3) * c + c / 2}
            className={`mini-board__mark mini-board__mark--${v.toLowerCase()}`}
            fontSize={c * 0.78}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {v}
          </text>
        ) : null,
      )}
    </g>
  );
}
