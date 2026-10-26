/** Percentage of a rate, or a dash when the value was never estimated. */
export const pct = (rate: number | null, digits = 1) =>
  rate === null ? '—' : `${(rate * 100).toFixed(digits).replace('.', ',')}%`;

export const num = (n: number) => n.toLocaleString('pt-BR');
