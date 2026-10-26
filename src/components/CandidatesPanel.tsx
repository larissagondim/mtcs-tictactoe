import { ListOrdered, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { moveLabel } from '../game/rules';
import type { TreeUi } from '../hooks/useTreeUi';
import type { SearchController } from '../mcts/controller';
import { LOW_SAMPLE_THRESHOLD, nodeStatistics } from '../mcts/statistics';
import type { Move } from '../game/types';
import type { NodeStatistics, SearchNode } from '../mcts/types';
import { fmtUct, num, pct } from './format';
import { OutcomeBar, Segmented } from './ui';

type SortKey = 'visits' | 'winRate' | 'uct';

interface Row {
  move: Move;
  node: SearchNode | null;
  stats: NodeStatistics | null;
}

export function CandidatesPanel({ controller: c, ui }: { controller: SearchController; ui: TreeUi }) {
  const [sort, setSort] = useState<SortKey>('visits');
  const tree = c.tree;
  const root = tree.root;
  const perspective = tree.rootPlayer;

  const rows: Row[] = [
    ...root.children.map((n) => ({ move: n.move as Move, node: n, stats: nodeStatistics(n, perspective, c.config.exploration) })),
    ...root.untriedMoves.map((m) => ({ move: m, node: null, stats: null })),
  ];
  const key = (r: Row): number => {
    if (!r.stats) return -Infinity;
    if (sort === 'visits') return r.stats.visits;
    if (sort === 'winRate') return r.stats.winRate ?? -Infinity;
    return r.stats.uct ?? -Infinity;
  };
  rows.sort((a, b) => key(b) - key(a) || a.move - b.move);

  const maxVisits = Math.max(1, ...rows.map((r) => r.stats?.visits ?? 0));
  const decided = c.decision?.nodeId ?? null;
  const leader = root.children.length ? tree.decide().nodeId : null;
  const highlightId = decided ?? (c.iterations > 0 ? leader : null);
  const highlightLabel = decided !== null ? 'escolhida' : 'líder atual';

  return (
    <section className="panel candidates-panel" aria-labelledby="cand-title">
      <header className="panel__header">
        <h2 id="cand-title">
          <ListOrdered size={16} aria-hidden /> Jogadas candidatas
        </h2>
        <span className="muted small">perspectiva de {perspective}</span>
      </header>

      <Segmented<SortKey>
        label="Ordenar por"
        small
        value={sort}
        onChange={setSort}
        options={[
          { value: 'visits', label: 'Visitas' },
          { value: 'winRate', label: 'Taxa de vitória' },
          { value: 'uct', label: 'UCT' },
        ]}
      />

      {root.terminal ? (
        <p className="muted small">Posição terminal: não há jogadas candidatas.</p>
      ) : (
        <ol className="cand-list">
          {rows.map((r) => {
            const s = r.stats;
            const isHighlight = r.node !== null && r.node.id === highlightId;
            return (
              <li key={r.move}>
                <button
                  type="button"
                  className={`cand${isHighlight ? ' is-chosen' : ''}${r.node && r.node.id === ui.selectedNode.id ? ' is-selected' : ''}`}
                  onClick={() => r.node && ui.select(r.node)}
                  disabled={!r.node}
                >
                  <span className="cand__move mono">{moveLabel(r.move)}</span>
                  <span className="cand__body">
                    <span className="cand__line">
                      <span className="cand__visits" title="Visitas">
                        <span className="cand__vbar" style={{ width: `${((s?.visits ?? 0) / maxVisits) * 100}%` }} />
                        <span className="mono">N {num(s?.visits ?? 0)}</span>
                      </span>
                      <span className="mono small cand__uct" title="UCT durante a busca">
                        UCT {s ? fmtUct(s.uct) : '—'}
                      </span>
                    </span>
                    <OutcomeBar win={s?.winRate ?? null} draw={s?.drawRate ?? null} loss={s?.lossRate ?? null} />
                    <span className="cand__line small">
                      {s && s.visits > 0 ? (
                        <span className="mono">
                          <span className="t-win">V {pct(s.winRate)}</span> · <span className="t-draw">E {pct(s.drawRate)}</span> ·{' '}
                          <span className="t-loss">D {pct(s.lossRate)}</span>
                        </span>
                      ) : (
                        <span className="muted">Não estimada</span>
                      )}
                      <span className="cand__badges">
                        {isHighlight && <span className="badge badge--ok">{highlightLabel}</span>}
                        {r.node?.terminal && <span className="badge badge--muted">terminal</span>}
                        {s && s.visits > 0 && s.lowSample && (
                          <span className="badge badge--warn" title={`Menos de ${LOW_SAMPLE_THRESHOLD} visitas: estimativa instável`}>
                            <TriangleAlert size={11} aria-hidden /> baixa amostra
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <details className="explain">
        <summary>Visitas, taxa de vitória e UCT não são a mesma coisa</summary>
        <ul>
          <li>
            <strong>Visitas</strong>: quantas iterações passaram pela jogada. É a política final da IA (o filho mais visitado), porque visitas acumulam onde a busca
            confiou repetidamente.
          </li>
          <li>
            <strong>Taxa de vitória</strong>: fração de rollouts vencidos por {perspective}. Com poucas visitas ela é instável — uma jogada vista 2 vezes pode ter
            100% por acaso.
          </li>
          <li>
            <strong>UCT</strong>: critério de <em>exploração</em> usado durante a busca (média + bônus para pouco visitados). Serve para escolher o próximo ramo
            a investigar, não a jogada final.
          </li>
        </ul>
      </details>
    </section>
  );
}
