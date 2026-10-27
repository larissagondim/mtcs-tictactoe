import { Pause, Play, RefreshCw } from 'lucide-react';
import { ITERATION_PRESETS, type Lab, type Speed } from '../hooks/useLab';
import { num } from './format';
import { Segmented } from './ui';

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 'step', label: 'Passo a passo' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Rápida' },
];

const ITERATION_OPTIONS = ITERATION_PRESETS.map((n) => ({ value: String(n), label: num(n) }));

export function SearchControls({ lab }: { lab: Lab }) {
  const c = lab.controller;
  const running = c.status === 'running';
  const canStart = lab.aiTurn && lab.treeIsCurrent && c.canRun && c.remaining > 0;
  const total = c.config.iterations;

  return (
    <section className="panel controls-panel" aria-labelledby="controls-title">
      <header className="panel__header">
        <h2 id="controls-title">Simulação</h2>
        <span className="muted small mono">
          {num(c.iterations)} / {num(total)} partidas simuladas
        </span>
      </header>

      <div className="progress" aria-hidden>
        <span style={{ width: `${Math.min(100, (c.iterations / total) * 100)}%` }} />
      </div>

      <div className="control-row">
        {running ? (
          <button type="button" className="btn btn--primary" onClick={() => c.pause()}>
            <Pause size={16} aria-hidden /> Pausar
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={!canStart} onClick={() => c.start()}>
            <Play size={16} aria-hidden /> {c.status === 'paused' ? 'Continuar' : 'Iniciar'}
          </button>
        )}
        <button type="button" className="btn" onClick={lab.restartSearch} title="Apaga a árvore e recomeça a análise desta posição">
          <RefreshCw size={16} aria-hidden /> Reiniciar
        </button>
      </div>

      <div className="field">
        <span className="field__label">Velocidade</span>
        <Segmented label="Velocidade" small value={lab.speed} onChange={lab.setSpeed} options={SPEEDS} />
      </div>

      <div className="field">
        <span className="field__label">Partidas simuladas por jogada</span>
        <Segmented
          label="Partidas simuladas por jogada"
          small
          value={String(lab.iterations)}
          onChange={(v) => lab.setIterations(Number(v))}
          options={ITERATION_OPTIONS}
        />
      </div>
    </section>
  );
}
