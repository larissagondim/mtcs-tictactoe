import { CornerLeftUp, Crosshair, TriangleAlert } from 'lucide-react';
import { moveLabel } from '../game/rules';
import type { TreeUi } from '../hooks/useTreeUi';
import type { SearchController } from '../mcts/controller';
import { toNodeView } from '../visualization/nodeView';
import { MiniBoard } from './Board';
import { fmtDecimal, fmtUct, num, outcomeText, pct, resultTone } from './format';
import { OutcomeBar } from './ui';

export function NodeDetails({ controller: c, ui }: { controller: SearchController; ui: TreeUi }) {
  const node = ui.selectedNode;
  const perspective = c.tree.rootPlayer;
  const v = toNodeView(node, perspective, c.config.exploration);
  const s = v.stats;
  const parent = node.parent;

  return (
    <section className="panel details-panel" aria-labelledby="details-title">
      <header className="panel__header">
        <h2 id="details-title">
          <Crosshair size={16} aria-hidden /> Nó selecionado <span className="mono muted">#{v.id}</span>
        </h2>
        {parent && (
          <button type="button" className="btn btn--small" onClick={() => ui.select(parent)}>
            <CornerLeftUp size={14} aria-hidden /> Pai
          </button>
        )}
      </header>

      <div className="details-top">
        <svg width={96} height={96} viewBox="0 0 96 96" aria-label="Tabuleiro do nó">
          <MiniBoard board={v.board} size={96} highlight={v.move} />
        </svg>
        <dl className="kv">
          <dt>Caminho</dt>
          <dd className="mono">{v.line.length ? v.line.join(' → ') : 'Raiz da busca'}</dd>
          <dt>Jogada</dt>
          <dd>{v.moveLabel ? `${v.playerJustMoved} em ${v.moveLabel}` : '—'}</dd>
          <dt>Próximo a jogar</dt>
          <dd>{node.terminal ? '— (terminal)' : v.playerToMove}</dd>
          <dt>Profundidade</dt>
          <dd className="mono">{v.depth}</dd>
          <dt>Filhos</dt>
          <dd className="mono">
            {v.childIds.length} expandidos · {v.untriedMoves.length} não explorados
          </dd>
        </dl>
      </div>

      {node.terminal && (
        <div className={`exact exact--${resultTone(node.terminal, perspective)}`}>
          <strong>Estado terminal — resultado exato:</strong> {outcomeText(node.terminal)}. Este valor não é uma estimativa; as contagens abaixo apenas registram quantas vezes a busca passou por aqui.
        </div>
      )}

      <div className="estimate">
        <div className="estimate__head">
          <span>Estimativa empírica (perspectiva de {perspective})</span>
          {s.visits > 0 && s.lowSample && (
            <span className="badge badge--warn">
              <TriangleAlert size={12} aria-hidden /> poucas amostras
            </span>
          )}
        </div>
        <OutcomeBar win={s.winRate} draw={s.drawRate} loss={s.lossRate} height={10} />
        {s.visits === 0 ? (
          <p className="muted small">Não estimada: este nó ainda não recebeu nenhuma simulação.</p>
        ) : (
          <table className="stat-table">
            <thead>
              <tr>
                <th />
                <th>Contagem</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="t-win">Vitória de {perspective}</th>
                <td className="mono">{num(s.wins)}</td>
                <td className="mono">{pct(s.winRate)}</td>
              </tr>
              <tr>
                <th className="t-draw">Empate</th>
                <td className="mono">{num(s.draws)}</td>
                <td className="mono">{pct(s.drawRate)}</td>
              </tr>
              <tr>
                <th className="t-loss">Derrota de {perspective}</th>
                <td className="mono">{num(s.losses)}</td>
                <td className="mono">{pct(s.lossRate)}</td>
              </tr>
              <tr>
                <th>Visitas (N)</th>
                <td className="mono">{num(s.visits)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
        {s.winInterval && (
          <p className="muted small">
            IC 95% (Wilson) da vitória: {pct(s.winInterval[0])} – {pct(s.winInterval[1])}. Recompensa média (empate = 0,5): {fmtDecimal(s.meanReward!, 3)} — não é
            probabilidade de vitória.
          </p>
        )}
      </div>

      {parent && (
        <div className="uct-box">
          <div className="uct-box__title">
            UCT visto pelo pai ({parent.playerToMove} escolhe) <strong className="mono">{fmtUct(s.uct)}</strong>
          </div>
          {v.uctTerms ? (
            <p className="mono small">
              = {fmtDecimal(v.uctTerms.exploitation, 3)} <span className="muted">(W/N de {parent.playerToMove})</span> + {fmtDecimal(v.uctTerms.exploration, 3)}{' '}
              <span className="muted">
                (C·√(ln {parent.visits}/{node.visits}))
              </span>
            </p>
          ) : (
            <p className="small muted">Nó não visitado: UCT = ∞, então será escolhido antes dos irmãos já visitados.</p>
          )}
        </div>
      )}

      {v.childIds.length > 0 && (
        <div className="child-list">
          <span className="field__label">Filhos (clique para inspecionar)</span>
          <div className="chips">
            {node.children
              .slice()
              .sort((a, b) => b.visits - a.visits)
              .map((ch) => (
                <button key={ch.id} type="button" className="chip" onClick={() => ui.select(ch)}>
                  {moveLabel(ch.move as number)} · {ch.visits} · {pct(ch.visits ? ch.outcomes[perspective] / ch.visits : null, 0)}
                </button>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
