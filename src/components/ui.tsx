import type { ComponentType, ReactNode } from 'react';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ComponentType<{ size?: number }> }[];
  small?: boolean;
}

export function Segmented<T extends string>({ label, value, onChange, options, small }: SegmentedProps<T>) {
  return (
    <div className={`segmented${small ? ' segmented--small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          className={v === value ? 'is-active' : ''}
          onClick={() => onChange(v)}
        >
          {Icon && <Icon size={15} />}
          {l}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden />
      <span>{children}</span>
    </label>
  );
}

/** Three-segment win/draw/loss bar. Renders an empty, hatched bar when not estimated. */
export function OutcomeBar({ win, draw, loss, height = 8 }: { win: number | null; draw: number | null; loss: number | null; height?: number }) {
  if (win === null || draw === null || loss === null) {
    return <div className="outcome-bar outcome-bar--empty" style={{ height }} aria-label="Não estimada" />;
  }
  return (
    <div
      className="outcome-bar"
      style={{ height }}
      role="img"
      aria-label={`Vitória ${(win * 100).toFixed(1)}%, empate ${(draw * 100).toFixed(1)}%, derrota ${(loss * 100).toFixed(1)}%`}
    >
      <span className="outcome-bar__win" style={{ width: `${win * 100}%` }} />
      <span className="outcome-bar__draw" style={{ width: `${draw * 100}%` }} />
      <span className="outcome-bar__loss" style={{ width: `${loss * 100}%` }} />
    </div>
  );
}

export function InfoTip({ children }: { children: ReactNode }) {
  return <p className="info-tip">{children}</p>;
}
