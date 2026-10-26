import { FlaskConical } from 'lucide-react';
import type { SearchStatus } from '../mcts/controller';
import type { Lab } from '../hooks/useLab';
import { num } from './format';

const STATUS_LABEL: Record<SearchStatus, string> = {
  idle: 'ociosa',
  running: 'em andamento',
  paused: 'pausada',
  completed: 'concluída',
  cancelled: 'cancelada',
};

const PHASE_LABEL = {
  selection: 'Seleção',
  expansion: 'Expansão',
  simulation: 'Simulação',
  backpropagation: 'Retropropagação',
  idle: '—',
  done: 'Iteração concluída',
} as const;

const MODE_LABEL = { pva: 'Você × IA', ava: 'IA × IA', analysis: 'Análise' } as const;

export function Header({ lab }: { lab: Lab }) {
  const c = lab.controller;
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand__logo" aria-hidden>
          <FlaskConical size={20} />
        </span>
        <div>
          <h1>MCTS Lab</h1>
          <p>Monte Carlo Tree Search, passo a passo, no jogo da velha</p>
        </div>
      </div>
      <div className="header-status" aria-live="polite">
        <span className={`pill pill--${c.status}`}>
          <span className="pill__dot" aria-hidden />
          Busca {STATUS_LABEL[c.status]}
        </span>
        <span className="header-status__item">
          <span className="muted">Etapa</span> <span className={`phase phase--${c.activity.phase}`}>{PHASE_LABEL[c.activity.phase]}</span>
        </span>
        <span className="header-status__item">
          <span className="muted">Iteração</span> <span className="mono">{num(c.iterations)}</span>
        </span>
        <span className="header-status__item">
          <span className="muted">Raiz</span> <span className="mono">{c.tree.rootPlayer} joga</span>
        </span>
        <span className="header-status__item hide-sm">
          <span className="muted">Modo</span> {MODE_LABEL[lab.mode]}
        </span>
      </div>
    </header>
  );
}
