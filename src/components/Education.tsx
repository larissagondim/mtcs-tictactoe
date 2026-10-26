import { BookOpen, FlaskConical, Play } from 'lucide-react';
import { useState } from 'react';
import { emptyBoard, moveLabel } from '../game/rules';
import type { Lab } from '../hooks/useLab';
import { compareSampleSizes, explorationProfile, type ExplorationProfile, type SampleSizeComparison, type Spread } from '../mcts/experiments';
import { fmtDecimal, num, pct } from './format';

const STEPS = [
  {
    key: 'selection',
    title: 'Selection — Seleção',
    text: 'A partir da raiz, o algoritmo desce pela árvore escolhendo, em cada nó, o filho com maior UCT. Assim equilibra aproveitamento (ramos que já deram bons resultados) e exploração (ramos pouco visitados), até chegar a um nó com jogadas ainda não exploradas ou a um estado terminal.',
  },
  {
    key: 'expansion',
    title: 'Expansion — Expansão',
    text: 'Se o nó alcançado ainda tem jogadas legais sem filho correspondente, uma delas é escolhida e vira um novo nó da árvore. Cada jogada é expandida no máximo uma vez por nó.',
  },
  {
    key: 'simulation',
    title: 'Simulation — Simulação',
    text: 'A partir do novo nó, uma partida é jogada até o fim (vitória, derrota ou empate) — o rollout. Na política aleatória cada jogada legal é igualmente provável; na heurística, o rollout vence quando pode e bloqueia vitórias imediatas do adversário.',
  },
  {
    key: 'backpropagation',
    title: 'Backpropagation — Retropropagação',
    text: 'O resultado do rollout sobe pelo caminho percorrido até a raiz: cada nó soma uma visita, o resultado (X, O ou empate) e a recompensa na perspectiva de quem jogou até ele.',
  },
] as const;

export function Education({ lab }: { lab: Lab }) {
  const usable = lab.game.outcome === null;
  const board = usable ? lab.game.board : emptyBoard();
  const toMove = usable ? lab.game.toMove : 'X';
  const [c, setC] = useState(Math.SQRT2);
  const [profile, setProfile] = useState<ExplorationProfile | null>(null);
  const [cmp, setCmp] = useState<SampleSizeComparison | null>(null);
  const [busy, setBusy] = useState<'c' | 'cmp' | null>(null);

  const runProfile = () => {
    setBusy('c');
    setTimeout(() => {
      setProfile(explorationProfile(board, toMove, c, 1000, Date.now() >>> 0));
      setBusy(null);
    }, 20);
  };
  const runComparison = () => {
    setBusy('cmp');
    setTimeout(() => {
      setCmp(compareSampleSizes(board, toMove, 50, 3000, 6, Date.now() >>> 0));
      setBusy(null);
    }, 20);
  };

  return (
    <section className="panel edu-panel area-edu" aria-labelledby="edu-title">
      <header className="panel__header">
        <h2 id="edu-title">
          <BookOpen size={16} aria-hidden /> Como o algoritmo pensa
        </h2>
      </header>
      <p className="edu-intro">
        O MCTS não conhece estratégia de jogo da velha: ele repete milhares de vezes um ciclo de quatro etapas e aprende, só pelas partidas simuladas, quais
        jogadas tendem a dar certo.
      </p>

      <div className="edu-steps">
        {STEPS.map((s, i) => (
          <article key={s.key} className={`edu-card edu-card--${s.key}`}>
            <span className="edu-card__num">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </div>

      <div className="edu-grid">
        <article className="edu-block">
          <h3>A fórmula UCT</h3>
          <div className="formula" aria-label="UCT i igual a W i sobre N i mais C vezes raiz de log natural de N p sobre N i">
            UCT<sub>i</sub> = <span className="frac"><span>W<sub>i</sub></span><span>N<sub>i</sub></span></span> + C ·{' '}
            <span className="sqrt">
              <span className="frac">
                <span>ln N<sub>p</sub></span>
                <span>N<sub>i</sub></span>
              </span>
            </span>
          </div>
          <ul className="edu-list">
            <li>
              <strong>W<sub>i</sub>/N<sub>i</sub></strong> — recompensa média do filho, na perspectiva de quem escolhe no pai (vitória 1, empate 0,5, derrota 0).
              Cada nó guarda a recompensa de quem jogou até ele, então X e O nunca se misturam.
            </li>
            <li>
              <strong>N<sub>i</sub>, N<sub>p</sub></strong> — visitas do filho e do pai. Filhos não visitados têm UCT = ∞ e são tentados primeiro.
            </li>
            <li>
              <strong>C</strong> — peso da exploração. C = 0 só aproveita; C alto espalha visitas por jogadas pouco testadas. O valor clássico é √2 ≈ 1,41.
            </li>
          </ul>

          <div className="experiment">
            <h4>
              <FlaskConical size={14} aria-hidden /> Experimento: efeito de C
            </h4>
            <label className="field">
              <span className="field__label">
                C = <strong className="mono">{fmtDecimal(c, 2)}</strong>
              </span>
              <input type="range" min={0} max={4} step={0.05} value={c} onChange={(e) => setC(Number(e.target.value))} />
            </label>
            <div className="button-row">
              <button type="button" className="btn btn--small" onClick={runProfile} disabled={busy !== null}>
                <Play size={14} aria-hidden /> {busy === 'c' ? 'Calculando…' : 'Rodar 1.000 iterações'}
              </button>
              <button type="button" className="btn btn--small" onClick={() => lab.updateConfig({ exploration: c })}>
                Usar este C na IA ({lab.editingPlayer})
              </button>
            </div>
            {profile && (
              <div className="profile">
                <p className="small muted">
                  C = {fmtDecimal(profile.exploration, 2)}: a jogada mais visitada recebeu <strong>{pct(profile.topShare)}</strong> das visitas da raiz;{' '}
                  {num(profile.nodeCount)} nós, profundidade {profile.maxDepth}. Compare com outros valores de C.
                </p>
                <ul className="share-bars">
                  {profile.moves.map((m) => (
                    <li key={m.move}>
                      <span className="mono">{moveLabel(m.move)}</span>
                      <span className="share-bars__track">
                        <span style={{ width: `${m.share * 100}%` }} />
                      </span>
                      <span className="mono small">{pct(m.share, 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>

        <article className="edu-block">
          <h3>O que as probabilidades significam</h3>
          <p>
            As taxas exibidas são <strong>estimativas empíricas</strong>: a fração dos rollouts que passaram por um nó e terminaram em vitória, empate ou derrota
            de <strong>{lab.controller.tree.rootPlayer}</strong>, o jogador que decide na raiz. Elas usam a mesma perspectiva em toda a árvore e somam 100%.
          </p>
          <ul className="edu-list">
            <li>Não são probabilidades exatas do jogo: dependem da política de rollout (rollouts aleatórios jogam mal) e mudam a cada nova simulação.</li>
            <li>Nós com poucas visitas são instáveis — por isso o selo “baixa amostra” e o intervalo de confiança.</li>
            <li>
              Recompensa média (empate = 0,5) é diferente de taxa de vitória; a IA usa a recompensa no UCT, mas as barras mostram vitória/empate/derrota
              separadamente.
            </li>
            <li>Estados terminais mostram o resultado exato, não uma estimativa.</li>
          </ul>

          <div className="experiment">
            <h4>
              <FlaskConical size={14} aria-hidden /> Experimento: busca curta × busca longa
            </h4>
            <p className="small muted">
              Repete 6 buscas de 50 iterações e 6 de 3.000 na posição {usable ? 'atual' : 'inicial'} ({toMove} joga), com sementes diferentes, e mostra a faixa
              (mín–máx) da taxa de vitória estimada de cada jogada.
            </p>
            <button type="button" className="btn btn--small" onClick={runComparison} disabled={busy !== null}>
              <Play size={14} aria-hidden /> {busy === 'cmp' ? 'Calculando…' : 'Comparar'}
            </button>
            {cmp && <ComparisonTable cmp={cmp} />}
          </div>
        </article>

        <article className="edu-block">
          <h3>Como a jogada final é escolhida</h3>
          <p>
            Ao fim da busca, a IA joga o filho da raiz com <strong>mais visitas</strong> (empates desfeitos pela recompensa média). Visitas são uma medida robusta:
            o UCT só manda muitas iterações para uma jogada se ela continuar boa sob escrutínio. O UCT em si não é usado para a decisão, porque inclui o bônus de
            exploração.
          </p>
          <p className="small muted">
            Se não houver iterações ou jogadas legais, nenhuma jogada é escolhida e isso aparece explicitamente no console.
          </p>
        </article>
      </div>
    </section>
  );
}

function ComparisonTable({ cmp }: { cmp: SampleSizeComparison }) {
  const bar = (s: Spread | null, kind: 'short' | 'long') =>
    s ? (
      <span className="range" title={`${pct(s.min)} – ${pct(s.max)} (média ${pct(s.mean)}, ${s.runs} buscas)`}>
        <span className={`range__band range__band--${kind}`} style={{ left: `${s.min * 100}%`, width: `${Math.max(0.8, (s.max - s.min) * 100)}%` }} />
        <span className="range__mean" style={{ left: `${s.mean * 100}%` }} />
      </span>
    ) : (
      <span className="muted small">não estimada</span>
    );
  return (
    <div className="cmp">
      <div className="cmp__head small muted">
        <span>Jogada</span>
        <span>{cmp.shortIterations} iterações</span>
        <span>{num(cmp.longIterations)} iterações</span>
      </div>
      {cmp.moves.map((m) => (
        <div key={m.move} className="cmp__row">
          <span className="mono">
            {moveLabel(m.move)}
            <span className="muted small">
              {' '}
              {cmp.decisions.short[m.move] ?? 0}/{cmp.decisions.long[m.move] ?? 0}
            </span>
          </span>
          {bar(m.short, 'short')}
          {bar(m.long, 'long')}
        </div>
      ))}
      <p className="small muted">
        Faixas na escala 0–100% de vitória; traço = média. Números ao lado da jogada: quantas buscas curtas/longas a escolheram. Com mais amostras as faixas
        estreitam e a escolha fica mais estável.
      </p>
    </div>
  );
}
