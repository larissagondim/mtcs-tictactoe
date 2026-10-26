import { MessageCircle } from 'lucide-react';
import type { SearchController } from '../mcts/controller';
import type { SearchPhase } from '../mcts/types';
import { narrate } from './narration';

const STEPS: { phase: SearchPhase; title: string; text: string }[] = [
  { phase: 'selection', title: 'Seleção', text: 'Escolhe um caminho promissor na árvore.' },
  { phase: 'expansion', title: 'Expansão', text: 'Acrescenta um lance novo, ainda não testado.' },
  { phase: 'simulation', title: 'Simulação', text: 'Joga uma partida imaginária até o fim.' },
  { phase: 'backpropagation', title: 'Retropropagação', text: 'Anota o resultado em todo o caminho.' },
];

export function StepsPanel({ controller: c }: { controller: SearchController }) {
  const animated = c.detailed && c.speed !== 'turbo';
  const active = animated && (c.status === 'running' || c.status === 'paused') ? c.activity.phase : null;
  const fastRun = !animated && c.status === 'running';

  return (
    <section className="panel steps-panel" aria-labelledby="steps-title">
      <h2 id="steps-title" className="sr-only">
        As quatro etapas do MCTS
      </h2>
      <ol className={`steps${fastRun ? ' steps--fast' : ''}`}>
        {STEPS.map((s, i) => (
          <li key={s.phase} className={`step step--${s.phase}${active === s.phase ? ' is-active' : ''}`} aria-current={active === s.phase ? 'step' : undefined}>
            <span className="step__num">{i + 1}</span>
            <span className="step__body">
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="narration" aria-live="polite">
        <MessageCircle size={16} aria-hidden />
        <span>{narrate(c)}</span>
      </p>
      {fastRun && <p className="muted small">Nesta velocidade as 4 etapas se repetem centenas de vezes por segundo. Use “Passo a passo” para ver cada uma.</p>}
    </section>
  );
}
