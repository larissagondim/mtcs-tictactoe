import type { Outcome, Player } from '../game/types';

const decimal = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

/** Percentage of a rate, or a dash when the value was never estimated. */
export const pct = (rate: number | null, digits = 1) => (rate === null ? '—' : `${decimal(rate * 100, digits)}%`);

export const num = (n: number) => n.toLocaleString('pt-BR');

export const fmtUct = (u: number | null) => (u === null ? '—' : u === Infinity ? '∞' : decimal(u, 3));

export const fmtDecimal = decimal;

export const outcomeText = (o: Outcome) => (o === 'draw' ? 'Empate' : `Vitória de ${o}`);

export function fmtDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${decimal(ms / 1000, ms < 10_000 ? 2 : 1)} s`;
}

/** Colour tone of a result for the perspective player. */
export const resultTone = (o: Outcome, perspective: Player) => (o === 'draw' ? 'draw' : o === perspective ? 'win' : 'loss');
