import { moveLabel } from '../game/rules';
import type { LogEntry } from '../mcts/controller';
import type { Outcome } from '../game/types';
import { fmtDecimal, fmtUct } from './format';

const outcomePhrase = (o: Outcome) => (o === 'draw' ? 'empate' : `vitória de ${o}`);

export type ConsoleStage = 'SELECTION' | 'EXPANSION' | 'SIMULATION' | 'BACKPROPAGATION' | 'UPDATE' | 'DECISION' | 'SISTEMA';

export const CONSOLE_STAGES: ConsoleStage[] = ['SELECTION', 'EXPANSION', 'SIMULATION', 'BACKPROPAGATION', 'UPDATE', 'DECISION', 'SISTEMA'];

export interface ConsoleLine {
  seq: number;
  stage: ConsoleStage;
  iteration: number;
  message: string;
}

/** Turns a real controller log entry into an explanatory console line. */
export function formatEntry(entry: LogEntry): ConsoleLine {
  if (entry.kind === 'system') {
    return {
      seq: entry.seq,
      stage: entry.stage === 'DECISION' ? 'DECISION' : 'SISTEMA',
      iteration: entry.iteration,
      message: entry.message,
    };
  }
  const e = entry.event;
  const base = { seq: entry.seq, iteration: e.iteration };
  switch (e.type) {
    case 'selection': {
      const chosen = e.candidates.find((c) => c.nodeId === e.chosenId);
      return {
        ...base,
        stage: 'SELECTION',
        message:
          `Avaliando ${e.candidates.length} filhos do nó #${e.nodeId} com UCT; selecionado ${moveLabel(e.move)} (#${e.chosenId}` +
          (chosen ? `, UCT ${fmtUct(chosen.uct)}, N ${chosen.visits})` : ')') +
          ' — melhor equilíbrio entre exploração e aproveitamento.',
      };
    }
    case 'selection-end':
      return {
        ...base,
        stage: 'SELECTION',
        message:
          e.reason === 'terminal'
            ? `Nó #${e.nodeId} é terminal: a seleção para aqui e não há expansão.`
            : `Nó #${e.nodeId} ainda tem jogadas não exploradas: a seleção termina aqui.`,
      };
    case 'expansion':
      return { ...base, stage: 'EXPANSION', message: `Novo nó #${e.nodeId} criado para a jogada legal ${moveLabel(e.move)} (filho de #${e.parentId}).` };
    case 'simulation': {
      const r = e.result;
      return {
        ...base,
        stage: 'SIMULATION',
        message:
          r.moves.length === 0
            ? `Nó #${e.nodeId} já é terminal: resultado exato ${outcomePhrase(r.outcome)}, sem rollout.`
            : `Rollout ${r.policy === 'random' ? 'aleatório' : 'heurístico'} de ${r.moves.length} jogada(s) a partir de #${e.nodeId}. Resultado: ${outcomePhrase(r.outcome)}.`,
      };
    }
    case 'backpropagation':
      return {
        ...base,
        stage: 'BACKPROPAGATION',
        message: `Nó #${e.nodeId} atualizado: N = ${e.visitsAfter}, recompensa +${fmtDecimal(e.reward, 1)} para quem jogou até ele.`,
      };
    case 'iteration-complete':
      return {
        ...base,
        stage: 'UPDATE',
        message: `Estatísticas atualizadas até a raiz (${e.path.length} nós); as estimativas de resultado foram recalculadas.`,
      };
  }
}
