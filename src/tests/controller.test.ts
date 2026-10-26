import { describe, expect, it } from 'vitest';
import { clampConfig, SearchController, type Scheduler } from '../mcts/controller';
import { mulberry32 } from '../mcts/rng';
import { DEFAULT_CONFIG, type MCTSConfig } from '../mcts/types';
import { b } from './helpers';

/** Scheduler whose callbacks run only when the test flushes them. */
function manualScheduler() {
  let queue: { fn: () => void; cancelled: boolean }[] = [];
  const scheduler: Scheduler = {
    schedule(fn) {
      const job = { fn, cancelled: false };
      queue.push(job);
      return () => {
        job.cancelled = true;
      };
    },
  };
  return {
    scheduler,
    get pending() {
      return queue.filter((j) => !j.cancelled).length;
    },
    /** Runs up to `n` ticks. */
    flush(n = Infinity) {
      while (n-- > 0) {
        const job = queue.find((j) => !j.cancelled);
        if (!job) return;
        queue = queue.filter((j) => j !== job);
        job.fn();
      }
    },
  };
}

const make = (config: Partial<MCTSConfig> = {}) => {
  const clock = manualScheduler();
  let t = 0;
  const ctrl = new SearchController(b('.........'), 'X', { ...DEFAULT_CONFIG, ...config }, {
    scheduler: clock.scheduler,
    rng: mulberry32(42),
    now: () => (t += 0.01),
  });
  return { ctrl, clock };
};

describe('SearchController', () => {
  it('runs to the iteration budget and decides', () => {
    const { ctrl, clock } = make({ iterations: 200 });
    ctrl.setDetailed(false);
    ctrl.setSpeed('turbo');
    let decided: number | null = null;
    ctrl.setOnComplete((d) => (decided = d.move));
    ctrl.start();
    clock.flush();
    expect(ctrl.status).toBe('completed');
    expect(ctrl.iterations).toBe(200);
    expect(ctrl.decision?.reason).toBe('most-visits');
    expect(decided).toBe(ctrl.decision?.move);
    expect(clock.pending).toBe(0);
  });

  it('pauses and resumes the same search without losing the tree', () => {
    const { ctrl, clock } = make({ iterations: 100 });
    ctrl.setDetailed(false);
    ctrl.start();
    clock.flush(3); // normal speed: 5 iterations per tick
    ctrl.pause();
    expect(ctrl.status).toBe('paused');
    const iterations = ctrl.iterations;
    const nodes = ctrl.tree.nodeCount;
    const root = ctrl.tree.root;
    expect(iterations).toBe(15);
    clock.flush();
    expect(ctrl.iterations).toBe(iterations); // nothing ran while paused
    ctrl.resume();
    clock.flush();
    expect(ctrl.tree.root).toBe(root);
    expect(ctrl.tree.nodeCount).toBeGreaterThan(nodes);
    expect(ctrl.status).toBe('completed');
    expect(ctrl.iterations).toBe(100);
  });

  it('cancels in a controlled way: finishes the in-flight iteration and schedules nothing', () => {
    const { ctrl, clock } = make({ iterations: 100 });
    ctrl.setDetailed(true);
    ctrl.start();
    clock.flush(13); // mid-iteration
    expect(ctrl.midIteration).toBe(true);
    const listenerCalls: number[] = [];
    ctrl.subscribe(() => listenerCalls.push(ctrl.version));
    ctrl.cancel();
    expect(ctrl.status).toBe('cancelled');
    expect(ctrl.midIteration).toBe(false);
    const root = ctrl.tree.root;
    expect(root.visits).toBe(ctrl.iterations);
    const calls = listenerCalls.length;
    clock.flush();
    expect(clock.pending).toBe(0);
    expect(listenerCalls.length).toBe(calls); // no background updates after cancel
  });

  it('single-step runs exactly one full iteration', () => {
    const { ctrl } = make({ iterations: 10 });
    ctrl.setDetailed(false);
    ctrl.stepIteration();
    expect(ctrl.iterations).toBe(1);
    expect(ctrl.tree.root.visits).toBe(1);
    expect(ctrl.tree.nodeCount).toBe(2);
    expect(ctrl.status).toBe('paused');
    ctrl.stepIteration();
    expect(ctrl.iterations).toBe(2);
  });

  it('animated single-step plays one iteration event by event and then pauses', () => {
    const { ctrl, clock } = make({ iterations: 10 });
    ctrl.setDetailed(true);
    ctrl.stepIteration();
    expect(ctrl.status).toBe('running');
    clock.flush();
    expect(ctrl.iterations).toBe(1);
    expect(ctrl.status).toBe('paused');
    expect(ctrl.log.filter((e) => e.kind === 'event').map((e) => e.kind === 'event' && e.event.type)).toEqual([
      'selection-end',
      'expansion',
      'simulation',
      'backpropagation',
      'backpropagation',
      'iteration-complete',
    ]);
  });

  it('exposes activity in sync with the real phase', () => {
    const { ctrl } = make({ iterations: 10 });
    ctrl.stepEvent();
    expect(ctrl.activity.phase).toBe('selection');
    ctrl.stepEvent();
    expect(ctrl.activity.phase).toBe('expansion');
    const expanded = ctrl.activity.expandedNodeId!;
    expect(ctrl.tree.getNode(expanded)?.visits).toBe(0); // not simulated yet
    ctrl.stepEvent();
    expect(ctrl.activity.phase).toBe('simulation');
    ctrl.stepEvent();
    expect(ctrl.activity).toMatchObject({ phase: 'backpropagation', backpropIds: [expanded] });
    expect(ctrl.tree.getNode(expanded)?.visits).toBe(1);
    expect(ctrl.tree.root.visits).toBe(0); // root not updated yet
  });

  it('resets explicitly and logs it', () => {
    const { ctrl } = make({ iterations: 10 });
    ctrl.setDetailed(false);
    ctrl.stepIteration();
    ctrl.reset(b('X........'), 'O');
    expect(ctrl.iterations).toBe(0);
    expect(ctrl.tree.rootPlayer).toBe('O');
    expect(ctrl.status).toBe('idle');
    expect(ctrl.log.at(-1)).toMatchObject({ kind: 'system', stage: 'RESET' });
  });

  it('refuses to search a terminal position', () => {
    const { ctrl } = make();
    ctrl.reset(b('XXXOO....'), 'O');
    ctrl.start();
    expect(ctrl.status).toBe('idle');
    expect(ctrl.tree.decide().reason).toBe('terminal');
  });

  it('records chart samples from real data', () => {
    const { ctrl, clock } = make({ iterations: 50 });
    ctrl.setDetailed(false);
    ctrl.setSpeed('turbo');
    ctrl.start();
    clock.flush();
    const last = ctrl.samples.at(-1)!;
    expect(last.iteration).toBe(50);
    expect(last.nodeCount).toBe(ctrl.tree.nodeCount);
    expect(last.moves.reduce((s, m) => s + m.visits, 0)).toBe(50);
    expect(ctrl.samples[0].iteration).toBe(0);
  });

  it('clamps configuration to sane limits', () => {
    expect(clampConfig({ ...DEFAULT_CONFIG, iterations: 0 }).iterations).toBe(1);
    expect(clampConfig({ ...DEFAULT_CONFIG, iterations: 1e9 }).iterations).toBe(50_000);
    expect(clampConfig({ ...DEFAULT_CONFIG, exploration: -2 }).exploration).toBe(0);
  });
});
