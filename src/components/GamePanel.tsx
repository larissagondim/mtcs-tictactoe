import { RotateCcw } from 'lucide-react';
import { moveLabel } from '../game/rules';
import { AI, HUMAN, type Lab } from '../hooks/useLab';
import { Board } from './Board';
import { Segmented } from './ui';

export function GamePanel({ lab }: { lab: Lab }) {
  const { game } = lab;
  const status = gameStatus(lab);

  return (
    <section className="panel game-panel" aria-labelledby="game-title">
      <header className="panel__header">
        <h2 id="game-title">Partida</h2>
        <span className="muted small">
          Você: <strong className="mark-x">{HUMAN}</strong> · IA: <strong className="mark-o">{AI}</strong>
        </span>
      </header>

      <div className={`game-status game-status--${status.tone}`} role="status" aria-live="polite">
        {status.tone === 'busy' && <span className="spinner" aria-hidden />}
        <span>{status.text}</span>
      </div>

      <Board
        board={game.board}
        winningLine={game.winningLine}
        lastMove={game.lastMove}
        pendingMove={lab.pendingAiMove}
        disabled={game.toMove !== HUMAN || game.outcome !== null}
        onCell={lab.playCell}
      />

      <div className="game-actions">
        <Segmented
          label="Quem começa"
          small
          value={lab.starter}
          onChange={lab.setStarter}
          options={[
            { value: HUMAN, label: 'Você começa' },
            { value: AI, label: 'IA começa' },
          ]}
        />
        <button type="button" className="btn" onClick={lab.newGame}>
          <RotateCcw size={16} aria-hidden /> Nova partida
        </button>
      </div>
    </section>
  );
}

function gameStatus(lab: Lab): { tone: string; text: string } {
  const { game } = lab;
  if (game.outcome === 'draw') return { tone: 'draw', text: 'Empate!' };
  if (game.outcome === HUMAN) return { tone: 'win', text: 'Você venceu!' };
  if (game.outcome === AI) return { tone: 'loss', text: 'A IA venceu.' };
  if (lab.pendingAiMove !== null) return { tone: 'busy', text: `A IA vai jogar em ${moveLabel(lab.pendingAiMove)}.` };
  if (lab.aiTurn) {
    return lab.controller.status === 'running'
      ? { tone: 'busy', text: 'A IA está pensando…' }
      : { tone: 'idle', text: 'Vez da IA — clique em Iniciar.' };
  }
  return { tone: 'turn', text: 'Sua vez: clique em uma casa.' };
}
