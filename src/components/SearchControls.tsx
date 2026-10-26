import { CircleStop, Pause, Play, RefreshCw, SkipForward, StepForward, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { moveLabel } from '../game/rules';
import type { Player } from '../game/types';
import type { Lab } from '../hooks/useLab';
import { MAX_ITERATIONS, MIN_ITERATIONS, type AnimationSpeed } from '../mcts/controller';
import type { RolloutPolicy } from '../mcts/types';
import { fmtDecimal, num } from './format';
import { Segmented, Toggle } from './ui';

const PRESETS = [100, 500, 1000, 5000, 10000];
const SPEEDS: { value: AnimationSpeed; label: string }[] = [
  { value: 'slow', label: 'Lenta' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Rápida' },
  { value: 'turbo', label: 'Turbo' },
];

export function SearchControls({ lab }: { lab: Lab }) {
  const { controller: c, mode } = lab;
  const config = lab.configs[lab.editingPlayer];
  const [custom, setCustom] = useState('');
  const status = c.status;
  const running = status === 'running';
  const canRun = c.canRun && c.remaining > 0;
  const appliesToTree = c.tree.rootPlayer === lab.editingPlayer;
  const decision = c.decision;

  const submitCustom = () => {
    const n = Number(custom);
    if (Number.isFinite(n) && n >= MIN_ITERATIONS) lab.updateConfig({ iterations: Math.min(MAX_ITERATIONS, Math.round(n)) });
    setCustom('');
  };

  return (
    <section className="panel controls-panel" aria-labelledby="controls-title">
      <header className="panel__header">
        <h2 id="controls-title">Controles da busca</h2>
        <span className="muted small">
          {num(c.iterations)} / {num(c.config.iterations)}
        </span>
      </header>

      <div className="progress" aria-hidden>
        <span style={{ width: `${Math.min(100, (c.iterations / c.config.iterations) * 100)}%` }} />
      </div>

      <div className="button-grid">
        {running ? (
          <button type="button" className="btn btn--primary" onClick={() => c.pause()}>
            <Pause size={16} aria-hidden /> Pausar
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={!canRun} onClick={() => c.start()}>
            <Play size={16} aria-hidden /> {status === 'paused' ? 'Continuar' : status === 'cancelled' ? 'Retomar' : 'Iniciar'}
          </button>
        )}
        <button type="button" className="btn" disabled={!running && status !== 'paused'} onClick={() => c.cancel()}>
          <CircleStop size={16} aria-hidden /> Cancelar
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canRun && !c.midIteration}
          onClick={() => c.stepIteration()}
          title="Executa exatamente uma iteração completa (seleção → expansão → simulação → retropropagação)"
        >
          <SkipForward size={16} aria-hidden /> {c.midIteration ? 'Concluir iteração' : '1 iteração'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canRun && !c.midIteration}
          onClick={() => c.stepEvent()}
          title="Avança apenas a próxima etapa do algoritmo"
        >
          <StepForward size={16} aria-hidden /> Próxima etapa
        </button>
        <button type="button" className="btn" onClick={lab.resetSearch} title="Descarta a árvore e recomeça na posição atual">
          <RefreshCw size={16} aria-hidden /> Reiniciar busca
        </button>
        {lab.canApplyDecision && decision?.move != null && (
          <button type="button" className="btn btn--accent" onClick={lab.applyDecision}>
            <Wand2 size={16} aria-hidden /> Jogar {moveLabel(decision.move)}
          </button>
        )}
      </div>

      {mode === 'ava' && (
        <Segmented
          label="Estratégia em edição"
          small
          value={lab.editingPlayer}
          onChange={lab.setAvaEditing}
          options={(['X', 'O'] as Player[]).map((p) => ({ value: p, label: `Estratégia de ${p}` }))}
        />
      )}
      <p className="muted small">
        Configuração da IA que joga com <strong>{lab.editingPlayer}</strong>
        {!appliesToTree && ' (vale a partir da próxima busca dela)'}.
      </p>

      <fieldset className="field">
        <legend>Iterações máximas</legend>
        <div className="chips">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`chip${config.iterations === p ? ' is-active' : ''}`}
              onClick={() => lab.updateConfig({ iterations: p })}
            >
              {num(p)}
            </button>
          ))}
          <form
            className="chip-input"
            onSubmit={(e) => {
              e.preventDefault();
              submitCustom();
            }}
          >
            <input
              type="number"
              inputMode="numeric"
              min={MIN_ITERATIONS}
              max={MAX_ITERATIONS}
              placeholder={PRESETS.includes(config.iterations) ? 'Outro' : String(config.iterations)}
              value={custom}
              aria-label={`Número personalizado de iterações (${MIN_ITERATIONS} a ${MAX_ITERATIONS})`}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => custom && submitCustom()}
            />
          </form>
        </div>
      </fieldset>

      <label className="field">
        <span className="field__label">
          Exploração C <strong className="mono">{fmtDecimal(config.exploration, 2)}</strong>
          <button type="button" className="link" onClick={() => lab.updateConfig({ exploration: Math.SQRT2 })}>
            √2
          </button>
        </span>
        <input
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={config.exploration}
          onChange={(e) => lab.updateConfig({ exploration: Number(e.target.value) })}
        />
      </label>

      <div className="field">
        <span className="field__label">Política de rollout</span>
        <Segmented<RolloutPolicy>
          label="Política de rollout"
          small
          value={config.rolloutPolicy}
          onChange={(v) => lab.updateConfig({ rolloutPolicy: v })}
          options={[
            { value: 'random', label: 'Aleatória' },
            { value: 'heuristic', label: 'Heurística' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field__label">Velocidade da animação</span>
        <Segmented label="Velocidade" small value={c.speed} onChange={lab.setSpeed} options={SPEEDS} />
      </div>

      <div className="toggles">
        <Toggle checked={c.detailed} onChange={lab.setDetailed}>
          Detalhar cada etapa {c.speed === 'turbo' && <em className="muted">(ignorado no Turbo)</em>}
        </Toggle>
        {mode !== 'analysis' && (
          <Toggle checked={lab.autoPlay} onChange={lab.setAutoPlay}>
            IA joga automaticamente ao fim da busca
          </Toggle>
        )}
      </div>
    </section>
  );
}
