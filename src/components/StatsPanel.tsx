import { Gauge } from 'lucide-react';
import { moveLabel, otherPlayer } from '../game/rules';
import type { SearchController, SearchStatus } from '../mcts/controller';
import { LOW_SAMPLE_THRESHOLD } from '../mcts/statistics';
import { LineChart, type LineSeries } from './charts/LineChart';
import { fmtDuration, num, pct } from './format';

/** Validated categorical slots (dark): at most three highlighted series. */
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70'];

const STATUS_TEXT: Record<SearchStatus, string> = {
  idle: 'Ociosa',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function StatsPanel({ controller: c }: { controller: SearchController }) {
  const tree = c.tree;
  const perspective = tree.rootPlayer;
  const opp = otherPlayer(perspective);
  const totals = tree.rolloutTotals;
  const sims = totals.X + totals.O + totals.draw;
  let visited = 0;
  for (const n of tree.allNodes()) if (n.visits > 0) visited++;
  const leader = tree.root.children.length && tree.iterations > 0 ? tree.decide() : null;
  const sps = c.simulationsPerSecond;
  const samples = c.samples;

  // Highlight the three most-visited root moves; colours are assigned by cell
  // index within that set so a move keeps its colour while it stays in it.
  const top = [...tree.root.children]
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 3)
    .map((n) => n.move as number)
    .sort((a, b) => a - b);
  const allMoves = [...new Set(samples.flatMap((s) => s.moves.map((m) => m.move)))].sort((a, b) => a - b);
  const colorOf = (m: number) => (top.includes(m) ? SERIES_COLORS[top.indexOf(m)] : null);

  const winSeries: LineSeries[] = allMoves.map((m) => ({
    id: `w${m}`,
    label: moveLabel(m),
    color: colorOf(m),
    points: samples.map((s) => {
      const e = s.moves.find((x) => x.move === m);
      return { x: s.iteration, y: e?.winRate ?? null, low: !e || e.visits < LOW_SAMPLE_THRESHOLD };
    }),
  }));
  const visitSeries: LineSeries[] = allMoves.map((m) => ({
    id: `v${m}`,
    label: moveLabel(m),
    color: colorOf(m),
    points: samples.map((s) => ({ x: s.iteration, y: s.moves.find((x) => x.move === m)?.visits ?? 0 })),
  }));
  const nodeSeries: LineSeries[] = [
    { id: 'nodes', label: 'Nós', color: SERIES_COLORS[0], points: samples.map((s) => ({ x: s.iteration, y: s.nodeCount })) },
  ];
  const maxVisits = Math.max(1, ...visitSeries.flatMap((s) => s.points.map((p) => p.y ?? 0)));
  const maxNodes = Math.max(1, ...samples.map((s) => s.nodeCount));
  const few = tree.iterations < 30;

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: 'Iterações', value: num(tree.iterations), hint: `de ${num(c.config.iterations)}` },
    { label: 'Nós criados', value: num(tree.nodeCount) },
    { label: 'Nós visitados', value: num(visited) },
    { label: 'Simulações concluídas', value: num(sims) },
    { label: 'Profundidade máx.', value: String(tree.maxDepth) },
    { label: 'Duração (ativa)', value: fmtDuration(c.elapsedMs), hint: `CPU ${fmtDuration(c.computeMs)}` },
    { label: 'Simulações/s', value: sps === null ? '—' : num(Math.round(sps)), hint: 'tempo de cálculo' },
    {
      label: c.decision ? 'Jogada escolhida' : 'Melhor jogada atual',
      value: leader?.move != null ? moveLabel(leader.move) : '—',
      hint: leader?.move != null ? `${num(leader.visits)} visitas` : undefined,
    },
    { label: 'Estado', value: STATUS_TEXT[c.status] },
  ];

  const parts = [
    { key: 'win', label: `Vitória de ${perspective}`, count: totals[perspective] },
    { key: 'draw', label: 'Empate', count: totals.draw },
    { key: 'loss', label: `Vitória de ${opp}`, count: totals[opp] },
  ];

  return (
    <section className="panel stats-panel area-stats" aria-labelledby="stats-title">
      <header className="panel__header">
        <h2 id="stats-title">
          <Gauge size={16} aria-hidden /> Estatísticas globais
        </h2>
        <span className="muted small">Resultados na perspectiva de {perspective} (jogador da raiz)</span>
      </header>

      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile">
            <span className="tile__label">{t.label}</span>
            <span className="tile__value mono">{t.value}</span>
            {t.hint && <span className="tile__hint">{t.hint}</span>}
          </div>
        ))}
      </div>

      <div className="outcome-dist">
        <div className="outcome-dist__head">
          <h3>Distribuição dos rollouts</h3>
          <span className="muted small">{num(sims)} simulações</span>
        </div>
        {sims === 0 ? (
          <p className="muted small">Nenhuma simulação ainda.</p>
        ) : (
          <>
            <div className="dist-bar" role="img" aria-label={parts.map((p) => `${p.label}: ${p.count}`).join(', ')}>
              {parts.map((p) =>
                p.count > 0 ? <span key={p.key} className={`dist-bar__${p.key}`} style={{ flexGrow: p.count }} title={`${p.label}: ${p.count}`} /> : null,
              )}
            </div>
            <ul className="dist-legend">
              {parts.map((p) => (
                <li key={p.key}>
                  <span className={`chart__swatch dist-bar__${p.key}`} />
                  {p.label}
                  <span className="mono">
                    {num(p.count)} · {pct(p.count / sims)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="charts">
        <figure className="chart-card">
          <figcaption>
            Taxa estimada de vitória por jogada {few && <span className="badge badge--warn">poucas amostras</span>}
          </figcaption>
          <LineChart
            series={winSeries}
            yMax={1}
            yFormat={(v) => pct(v, 0)}
            xLabel="Iteração"
            ariaLabel="Evolução da taxa estimada de vitória das jogadas candidatas"
          />
          <ChartLegend series={winSeries} note={`Tracejado: menos de ${LOW_SAMPLE_THRESHOLD} visitas na jogada.`} />
        </figure>
        <figure className="chart-card">
          <figcaption>Visitas por jogada</figcaption>
          <LineChart series={visitSeries} yMax={maxVisits} yFormat={(v) => num(Math.round(v))} xLabel="Iteração" ariaLabel="Evolução do número de visitas por jogada" />
          <ChartLegend series={visitSeries} />
        </figure>
        <figure className="chart-card">
          <figcaption>Crescimento da árvore (nós)</figcaption>
          <LineChart series={nodeSeries} yMax={maxNodes} yFormat={(v) => num(Math.round(v))} xLabel="Iteração" ariaLabel="Crescimento do número de nós da árvore" />
        </figure>
      </div>
      <p className="muted small">
        Séries amostradas a cada {samples.length > 1 ? num(samples[1].iteration - samples[0].iteration) : 1} iteração(ões) para manter a interface leve; os dados
        do algoritmo não são reduzidos.
      </p>
    </section>
  );
}

function ChartLegend({ series, note }: { series: LineSeries[]; note?: string }) {
  const colored = series.filter((s) => s.color);
  const others = series.length - colored.length;
  return (
    <div className="chart-legend">
      {colored.map((s) => (
        <span key={s.id}>
          <span className="chart__swatch" style={{ background: s.color! }} />
          {s.label}
        </span>
      ))}
      {others > 0 && (
        <span>
          <span className="chart__swatch" style={{ background: 'var(--chart-other)' }} />
          outras ({others})
        </span>
      )}
      {note && <span className="muted">{note}</span>}
    </div>
  );
}
