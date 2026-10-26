import { describe, expect, it } from 'vitest';
import { formatEntry } from '../components/eventFormat';
import { SearchController } from '../mcts/controller';
import { mulberry32 } from '../mcts/rng';
import { DEFAULT_CONFIG } from '../mcts/types';
import { b } from './helpers';

describe('console formatting', () => {
  it('describes each real event of an iteration in order', () => {
    const ctrl = new SearchController(b('.........'), 'X', { ...DEFAULT_CONFIG, iterations: 5 }, { rng: mulberry32(1) });
    ctrl.setDetailed(false);
    ctrl.stepIteration();
    const lines = ctrl.log.map(formatEntry);
    expect(lines.map((l) => l.stage)).toEqual(['SELECTION', 'EXPANSION', 'SIMULATION', 'BACKPROPAGATION', 'BACKPROPAGATION', 'UPDATE']);
    const expansion = ctrl.log.find((e) => e.kind === 'event' && e.event.type === 'expansion');
    expect(expansion && formatEntry(expansion).message).toMatch(/Novo nó #1 criado/);
    const sim = ctrl.log.find((e) => e.kind === 'event' && e.event.type === 'simulation');
    const outcome = sim?.kind === 'event' && sim.event.type === 'simulation' ? sim.event.result.outcome : null;
    expect(formatEntry(sim!).message).toMatch(outcome === 'draw' ? /empate/ : new RegExp(`vitória de ${outcome}`));
  });

  it('labels decisions and system messages', () => {
    const ctrl = new SearchController(b('.........'), 'X', { ...DEFAULT_CONFIG, iterations: 1 }, { rng: mulberry32(1) });
    ctrl.setDetailed(false);
    ctrl.stepIteration();
    expect(formatEntry(ctrl.log.at(-1)!).stage).toBe('DECISION');
    ctrl.reset(b('.........'), 'O');
    expect(formatEntry(ctrl.log.at(-1)!)).toMatchObject({ stage: 'SISTEMA', message: expect.stringMatching(/reinicializada/) });
  });
});
