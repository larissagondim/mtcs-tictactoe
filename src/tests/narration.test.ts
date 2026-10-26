import { describe, expect, it } from 'vitest';
import { narrate } from '../components/narration';
import { SearchController } from '../mcts/controller';
import { mulberry32 } from '../mcts/rng';
import { DEFAULT_CONFIG } from '../mcts/types';
import { b } from './helpers';

const make = (iterations = 20) => {
  const c = new SearchController(b('X........'), 'O', { ...DEFAULT_CONFIG, iterations }, { rng: mulberry32(5) });
  c.setDetailed(true);
  c.setSpeed('slow');
  return c;
};

describe('narration', () => {
  it('follows the real phase of the search step by step', () => {
    const c = make();
    c.stepEvent();
    expect(narrate(c)).toMatch(/^Seleção: chegou a uma posição/);
    c.stepEvent();
    expect(narrate(c)).toMatch(/^Expansão: .*e se a IA jogar em [ABC][123]\?/);
    c.stepEvent();
    expect(narrate(c)).toMatch(/^Simulação: .*Resultado: (a IA venceu|a IA perdeu|empate)\./);
    c.stepEvent();
    expect(narrate(c)).toMatch(/^Retropropagação/);
  });

  it('explains the final decision with real visit counts', () => {
    const c = make(200);
    c.setDetailed(false);
    for (let i = 0; i < 200; i++) c.stepIteration();
    expect(c.status).toBe('completed');
    const chosen = c.tree.getNode(c.decision!.nodeId!)!;
    expect(narrate(c)).toContain(`(${chosen.visits} de 200 partidas simuladas)`);
  });

  it('describes a fast run with the current leader', () => {
    const c = make(50);
    c.setDetailed(false);
    c.stepIteration();
    expect(narrate(c)).toMatch(/Simulando partidas rapidamente: 1 de 50/);
  });
});
