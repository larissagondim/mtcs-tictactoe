import { FlaskConical } from 'lucide-react';
import type { SearchStatus } from '../mcts/controller';
import type { Lab } from '../hooks/useLab';

const STATUS_LABEL: Record<SearchStatus, string> = {
  idle: 'IA aguardando',
  running: 'IA pensando',
  paused: 'Pausado',
  completed: 'Análise concluída',
  cancelled: 'Interrompido',
};

export function Header({ lab }: { lab: Lab }) {
  const status = lab.controller.status;
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand__logo" aria-hidden>
          <FlaskConical size={20} />
        </span>
        <div>
          <h1>Como a IA pensa</h1>
          <p>Monte Carlo Tree Search no jogo da velha</p>
        </div>
      </div>
      <span className={`pill pill--${status}`} aria-live="polite">
        <span className="pill__dot" aria-hidden />
        {STATUS_LABEL[status]}
      </span>
    </header>
  );
}
