import { Bot, Eraser, Microscope, RotateCcw, Swords, TriangleAlert, User, Users } from 'lucide-react';
import { moveLabel } from '../game/rules';
import type { Player } from '../game/types';
import type { GameMode, Lab } from '../hooks/useLab';
import { Board } from './Board';
import { Segmented } from './ui';

const MODES: { value: GameMode; label: string; icon: typeof Swords }[] = [
  { value: 'pva', label: 'Você × IA', icon: Swords },
  { value: 'ava', label: 'IA × IA', icon: Users },
  { value: 'analysis', label: 'Análise', icon: Microscope },
];

export function GamePanel({ lab }: { lab: Lab }) {
  const { game, mode, controller } = lab;
  const searching = controller.status === 'running';
  const status = gameStatus(lab, searching);

  return (
    <section className="panel game-panel" aria-labelledby="game-title">
      <header className="panel__header">
        <h2 id="game-title">Partida</h2>
      </header>

      <Segmented label="Modo de jogo" value={mode} onChange={lab.setMode} options={MODES} />

      {mode !== 'analysis' && (
        <div className="row-controls">
          {mode === 'pva' && (
            <Segmented
              label="Você joga com"
              small
              value={lab.humanPlayer}
              onChange={lab.setHumanPlayer}
              options={(['X', 'O'] as Player[]).map((p) => ({ value: p, label: `Você: ${p}` }))}
            />
          )}
          <Segmented
            label="Quem começa"
            small
            value={lab.starter}
            onChange={lab.setStarter}
            options={(['X', 'O'] as Player[]).map((p) => ({ value: p, label: `${p} começa` }))}
          />
        </div>
      )}

      {mode === 'analysis' && (
        <div className="row-controls">
          <Segmented
            label="Ferramenta"
            small
            value={lab.analysisTool}
            onChange={lab.setAnalysisTool}
            options={[
              { value: 'play', label: 'Jogar' },
              { value: 'edit', label: 'Editar peças' },
            ]}
          />
          <Segmented
            label="Vez de"
            small
            value={game.toMove}
            onChange={lab.setAnalysisToMove}
            options={(['X', 'O'] as Player[]).map((p) => ({ value: p, label: `Vez de ${p}` }))}
          />
        </div>
      )}

      <div className={`game-status game-status--${status.tone}`} role="status" aria-live="polite">
        {status.icon}
        <span>{status.text}</span>
      </div>

      <Board
        board={game.board}
        winningLine={game.winningLine}
        lastMove={game.lastMove}
        pendingMove={lab.pendingAiMove}
        editing={mode === 'analysis' && lab.analysisTool === 'edit'}
        disabled={
          mode === 'ava' ||
          (mode === 'pva' && (game.toMove !== lab.humanPlayer || game.outcome !== null)) ||
          (mode === 'analysis' && lab.analysisTool === 'play' && game.outcome !== null)
        }
        onCell={lab.playCell}
      />

      {mode === 'analysis' && lab.validation && (
        <div className={`validation ${lab.validation.reachable ? 'validation--ok' : 'validation--bad'}`}>
          {lab.validation.reachable ? (
            <span>
              Posição legal — alcançável quando {lab.validation.startingPlayers.join(' ou ')} começa.
            </span>
          ) : (
            <>
              <strong>
                <TriangleAlert size={14} aria-hidden /> Posição artificial
              </strong>
              <ul>
                {lab.validation.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <span>A busca ainda funciona, mas não corresponde a uma partida real.</span>
            </>
          )}
        </div>
      )}

      <div className="button-row">
        {mode === 'analysis' ? (
          <button type="button" className="btn" onClick={lab.clearAnalysisBoard}>
            <Eraser size={16} aria-hidden /> Limpar tabuleiro
          </button>
        ) : (
          <button type="button" className="btn" onClick={lab.newGame}>
            <RotateCcw size={16} aria-hidden /> Nova partida
          </button>
        )}
        {game.history.length > 0 && (
          <span className="muted small">Lances: {game.history.map(moveLabel).join(' · ')}</span>
        )}
      </div>
    </section>
  );
}

function gameStatus(lab: Lab, searching: boolean) {
  const { game, mode } = lab;
  if (game.outcome === 'draw') return { tone: 'draw', text: 'Fim de jogo: empate.', icon: null };
  if (game.outcome) {
    const who = mode === 'pva' ? (game.outcome === lab.humanPlayer ? ' Você venceu!' : ' A IA venceu.') : '';
    return { tone: game.outcome === lab.humanPlayer || mode !== 'pva' ? 'win' : 'loss', text: `Fim de jogo: ${game.outcome} venceu.${who}`, icon: null };
  }
  if (lab.pendingAiMove !== null) {
    return { tone: 'busy', text: `IA (${game.toMove}) decidiu: ${moveLabel(lab.pendingAiMove)}`, icon: <Bot size={16} aria-hidden /> };
  }
  if (lab.aiTurn) {
    return searching
      ? { tone: 'busy', text: `IA (${game.toMove}) está calculando…`, icon: <span className="spinner" aria-hidden /> }
      : { tone: 'idle', text: `Vez da IA (${game.toMove}) — inicie a busca.`, icon: <Bot size={16} aria-hidden /> };
  }
  if (mode === 'pva') return { tone: 'turn', text: `Sua vez (${game.toMove}).`, icon: <User size={16} aria-hidden /> };
  return { tone: 'turn', text: `Vez de ${game.toMove}.`, icon: null };
}
