import { useEffect, useRef, useState, type PointerEvent } from 'react';

export interface LinePoint {
  x: number;
  y: number | null;
  /** Drawn dashed: too few samples behind this value. */
  low?: boolean;
}

export interface LineSeries {
  id: string;
  label: string;
  /** null = recessive "other" series (gray, no direct label). */
  color: string | null;
  points: LinePoint[];
}

interface LineChartProps {
  series: LineSeries[];
  yMax: number;
  yFormat: (v: number) => string;
  xLabel: string;
  height?: number;
  ariaLabel: string;
}

const M = { top: 10, right: 44, bottom: 26, left: 44 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Minimal SVG line chart: one y axis, 2px lines, crosshair tooltip, direct labels. */
export function LineChart({ series, yMax, yFormat, xLabel, height = 180, ariaLabel }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);

  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMax = Math.max(1, ...xs);
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const sx = (x: number) => M.left + (x / xMax) * innerW;
  const sy = (y: number) => M.top + innerH - (y / (yMax || 1)) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xTicks = [0, 0.5, 1].map((f) => Math.round(f * xMax));

  /** Splits a series into solid and dashed runs, skipping null gaps. */
  const runs = (pts: LinePoint[]) => {
    const out: { low: boolean; d: string }[] = [];
    let cur: { low: boolean; pts: LinePoint[] } | null = null;
    for (const p of pts) {
      if (p.y === null) {
        if (cur) out.push(toRun(cur));
        cur = null;
        continue;
      }
      const low = !!p.low;
      if (cur && cur.low !== low) {
        cur.pts.push(p); // connect the runs
        out.push(toRun(cur));
        cur = { low, pts: [p] };
      } else if (cur) cur.pts.push(p);
      else cur = { low, pts: [p] };
    }
    if (cur) out.push(toRun(cur));
    return out;
  };
  const toRun = (r: { low: boolean; pts: LinePoint[] }) => ({
    low: r.low,
    d: r.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y!).toFixed(1)}`).join(''),
  });

  const ordered = [...series.filter((s) => !s.color), ...series.filter((s) => s.color)];

  // Hover: nearest sampled x.
  const allX = [...new Set(xs)].sort((a, b) => a - b);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left - M.left) / innerW) * xMax;
    let best: number | null = null;
    for (const v of allX) if (best === null || Math.abs(v - x) < Math.abs(best - x)) best = v;
    setHoverX(best);
  };
  const hoverRows =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
          .filter((r) => r.p && r.p.y !== null)
          .sort((a, b) => (b.p!.y ?? 0) - (a.p!.y ?? 0));

  // Direct labels at the end of coloured series, nudged apart vertically.
  const labels = series
    .filter((s) => s.color)
    .map((s) => {
      const last = [...s.points].reverse().find((p) => p.y !== null);
      return last ? { s, dotY: sy(last.y!), y: sy(last.y!), x: sx(last.x) } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHoverX(null)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line className="chart__grid" x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
            <text className="chart__tick" x={M.left - 6} y={sy(t)} textAnchor="end" dominantBaseline="central">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} className="chart__tick" x={sx(t)} y={height - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
            {t.toLocaleString('pt-BR')}
          </text>
        ))}
        {ordered.map((s) =>
          runs(s.points).map((r, i) => (
            <path
              key={`${s.id}-${i}`}
              d={r.d}
              fill="none"
              stroke={s.color ?? 'var(--chart-other)'}
              strokeWidth={s.color ? 2 : 1}
              strokeDasharray={r.low ? '3 3' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )),
        )}
        {labels.map(({ s, x, y, dotY }) => (
          <g key={s.id}>
            <circle cx={x} cy={dotY} r={3} fill={s.color!} />
            <text className="chart__label" x={x + 6} y={y} dominantBaseline="central">
              {s.label}
            </text>
          </g>
        ))}
        {hoverX !== null && (
          <g pointerEvents="none">
            <line className="chart__crosshair" x1={sx(hoverX)} x2={sx(hoverX)} y1={M.top} y2={M.top + innerH} />
            {hoverRows.map(({ s, p }) => (
              <circle key={s.id} cx={sx(hoverX)} cy={sy(p!.y!)} r={4} fill={s.color ?? 'var(--chart-other)'} className="chart__dot" />
            ))}
          </g>
        )}
      </svg>
      <span className="chart__xlabel">{xLabel}</span>
      {hoverX !== null && hoverRows.length > 0 && (
        <div className="chart__tooltip" style={{ left: Math.min(sx(hoverX) + 10, width - 150) }}>
          <div className="chart__tooltip-title">
            {xLabel} {hoverX.toLocaleString('pt-BR')}
          </div>
          {hoverRows.slice(0, 6).map(({ s, p }) => (
            <div key={s.id} className="chart__tooltip-row">
              <span className="chart__swatch" style={{ background: s.color ?? 'var(--chart-other)' }} />
              <span>{s.label}</span>
              <span className="mono">
                {yFormat(p!.y!)}
                {p!.low ? '*' : ''}
              </span>
            </div>
          ))}
          {hoverRows.some((r) => r.p!.low) && <div className="chart__tooltip-note">* poucas amostras</div>}
        </div>
      )}
    </div>
  );
}
