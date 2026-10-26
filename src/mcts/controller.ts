import type { Board, Move, Outcome, Player } from '../game/types';
import { MCTSTree, type TreeOptions } from './tree';
import type { Decision, MCTSConfig, OutcomeCounts, SearchEvent, SearchPhase, SimulationResult } from './types';

export type SearchStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';
export type AnimationSpeed = 'slow' | 'normal' | 'fast' | 'turbo';

export const MIN_ITERATIONS = 1;
export const MAX_ITERATIONS = 50_000;

/** Delay between animated events when step detail is on. */
export const EVENT_DELAY: Record<Exclude<AnimationSpeed, 'turbo'>, number> = { slow: 700, normal: 260, fast: 70 };
/** Batch mode: iterations per tick and delay between ticks. Turbo uses a time budget instead. */
const BATCH: Record<Exclude<AnimationSpeed, 'turbo'>, { iterations: number; delay: number }> = {
  slow: { iterations: 1, delay: 250 },
  normal: { iterations: 5, delay: 40 },
  fast: { iterations: 40, delay: 16 },
};
const TURBO_BUDGET_MS = 12;
const MAX_SAMPLES = 300;

export interface Scheduler {
  /** Runs `fn` after `delayMs`; returns a function that cancels it. */
  schedule(fn: () => void, delayMs: number): () => void;
}

export const timeoutScheduler: Scheduler = {
  schedule(fn, delayMs) {
    const id = setTimeout(fn, delayMs);
    return () => clearTimeout(id);
  },
};

export type LogEntry =
  | { seq: number; kind: 'event'; event: SearchEvent }
  | { seq: number; kind: 'system'; stage: 'RESET' | 'CONTROL' | 'DECISION' | 'CONFIG'; iteration: number; message: string };

/** What the algorithm is doing right now; drives the tree highlighting. */
export interface Activity {
  phase: SearchPhase | 'idle' | 'done';
  iteration: number;
  /** Selection path (root first) of the current/last iteration. */
  path: number[];
  currentNodeId: number | null;
  expandedNodeId: number | null;
  simulation: { nodeId: number; result: SimulationResult } | null;
  /** Nodes already updated by the ongoing backpropagation. */
  backpropIds: number[];
}

export interface SearchSample {
  iteration: number;
  nodeCount: number;
  maxDepth: number;
  totals: OutcomeCounts;
  /** Root children: visits and win rate (root player's perspective) at this point. */
  moves: { move: Move; visits: number; winRate: number | null }[];
}

export interface ControllerOptions extends TreeOptions {
  scheduler?: Scheduler;
  now?: () => number;
  logLimit?: number;
}

const idleActivity = (): Activity => ({
  phase: 'idle',
  iteration: 0,
  path: [],
  currentNodeId: null,
  expandedNodeId: null,
  simulation: null,
  backpropIds: [],
});

export class SearchController {
  tree!: MCTSTree;
  config: MCTSConfig;
  status: SearchStatus = 'idle';
  speed: AnimationSpeed = 'normal';
  /** Animate every phase (selection, expansion, simulation, each backprop step). */
  detailed = true;
  activity: Activity = idleActivity();
  log: LogEntry[] = [];
  samples: SearchSample[] = [];
  decision: Decision | null = null;
  /** Time spent inside the algorithm itself (ms). */
  computeMs = 0;
  /** Wall-clock time while running, excluding pauses (ms). */
  activeMs = 0;
  /** Incremented on every observable change. */
  version = 0;
  onComplete: ((decision: Decision) => void) | null = null;

  private readonly scheduler: Scheduler;
  private readonly now: () => number;
  private readonly logLimit: number;
  private readonly treeOptions: TreeOptions;
  private inFlight: Generator<SearchEvent, Outcome> | null = null;
  private cancelTick: (() => void) | null = null;
  private runningSince: number | null = null;
  private stopAfterIteration = false;
  private sampleEvery = 1;
  private seq = 0;
  private listeners = new Set<() => void>();

  constructor(board: Board, toMove: Player, config: MCTSConfig, options: ControllerOptions = {}) {
    this.scheduler = options.scheduler ?? timeoutScheduler;
    this.now = options.now ?? (() => performance.now());
    this.logLimit = options.logLimit ?? 500;
    this.treeOptions = { rng: options.rng, simulator: options.simulator };
    this.config = clampConfig(config);
    this.newTree(board, toMove);
  }

  // ---------- subscription ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  // ---------- derived ----------

  get iterations(): number {
    return this.tree.iterations;
  }

  get midIteration(): boolean {
    return this.inFlight !== null;
  }

  get remaining(): number {
    return Math.max(0, this.config.iterations - this.tree.iterations);
  }

  /** Simulations per second of pure compute time. */
  get simulationsPerSecond(): number | null {
    return this.computeMs > 0 ? (this.tree.iterations / this.computeMs) * 1000 : null;
  }

  get elapsedMs(): number {
    return this.activeMs + (this.runningSince !== null ? this.now() - this.runningSince : 0);
  }

  get canRun(): boolean {
    return this.tree.root.terminal === null && this.status !== 'completed';
  }

  // ---------- controls ----------

  /** Discards the tree and starts over at a position (explicitly logged). */
  reset(board: Board, toMove: Player, config: MCTSConfig = this.config, reason = 'Árvore de busca reinicializada.') {
    this.halt();
    this.config = clampConfig(config);
    this.newTree(board, toMove);
    this.system('RESET', reason);
    this.notify();
  }

  start() {
    if (this.status === 'running' || !this.canRun) return;
    if (this.status === 'cancelled') {
      // A cancelled search keeps its tree; starting again continues it.
      this.system('CONTROL', 'Busca retomada após cancelamento (árvore preservada).');
    } else if (this.status === 'paused') {
      this.system('CONTROL', 'Busca continuada.');
    } else {
      this.system('CONTROL', `Busca iniciada: até ${this.config.iterations} iterações.`);
    }
    this.stopAfterIteration = false;
    this.setRunning();
    this.notify();
    this.scheduleTick(0);
  }

  pause() {
    if (this.status !== 'running') return;
    this.halt();
    this.status = 'paused';
    this.system('CONTROL', `Busca pausada na iteração ${this.tree.iterations}${this.inFlight ? ' (iteração em andamento preservada)' : ''}.`);
    this.notify();
  }

  resume() {
    if (this.status === 'paused') this.start();
  }

  /**
   * Stops the search in a controlled way: the iteration in progress is finished
   * synchronously so every node stays consistent, then no further work is scheduled.
   */
  cancel() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.halt();
    if (this.inFlight) this.finishInFlight();
    this.status = 'cancelled';
    this.system('CONTROL', `Busca cancelada após ${this.tree.iterations} iterações. A árvore foi mantida.`);
    this.notify();
  }

  /**
   * Exactly one complete selection → expansion → simulation → backpropagation.
   * If an iteration is already in progress, it is completed instead.
   * With step detail on, the iteration is animated and the search pauses afterwards.
   */
  stepIteration() {
    if (!this.canRun || this.remaining === 0) return;
    if (this.status === 'running') this.halt();
    if (this.detailed && this.speed !== 'turbo') {
      this.stopAfterIteration = true;
      this.setRunning();
      this.notify();
      this.scheduleTick(0);
      return;
    }
    const t0 = this.now();
    if (this.inFlight) this.finishInFlight();
    else this.runOneIteration();
    this.computeMs += this.now() - t0;
    this.afterManualStep();
  }

  /** Advances a single phase event (fine-grained study mode). */
  stepEvent() {
    if (!this.canRun || (this.remaining === 0 && !this.inFlight)) return;
    if (this.status === 'running') this.halt();
    const t0 = this.now();
    this.advance();
    this.computeMs += this.now() - t0;
    this.afterManualStep();
  }

  updateConfig(partial: Partial<MCTSConfig>) {
    const next = clampConfig({ ...this.config, ...partial });
    const changes: string[] = [];
    if (next.exploration !== this.config.exploration) changes.push(`C = ${next.exploration.toFixed(2)}`);
    if (next.rolloutPolicy !== this.config.rolloutPolicy) changes.push(`rollout ${next.rolloutPolicy === 'random' ? 'aleatório' : 'heurístico'}`);
    if (next.iterations !== this.config.iterations) changes.push(`máximo de ${next.iterations} iterações`);
    this.config = next;
    // C and rollout policy take effect from the next iteration of the current tree.
    this.tree.config.exploration = next.exploration;
    this.tree.config.rolloutPolicy = next.rolloutPolicy;
    this.tree.config.iterations = next.iterations;
    if (changes.length) this.system('CONFIG', `Configuração alterada: ${changes.join(', ')}.`);
    if (this.status === 'completed' && this.remaining > 0) this.status = 'paused';
    if (this.status === 'running' && this.remaining === 0 && !this.inFlight) this.complete();
    this.notify();
  }

  setSpeed(speed: AnimationSpeed) {
    this.speed = speed;
    this.notify();
  }

  setDetailed(detailed: boolean) {
    this.detailed = detailed;
    this.notify();
  }

  /** Stops all scheduled work. Call when the owner unmounts. */
  dispose() {
    this.halt();
    this.listeners.clear();
    this.onComplete = null;
  }

  // ---------- internals ----------

  private newTree(board: Board, toMove: Player) {
    this.tree = new MCTSTree(board, toMove, this.config, this.treeOptions);
    this.status = 'idle';
    this.inFlight = null;
    this.activity = idleActivity();
    this.samples = [];
    this.sampleEvery = 1;
    this.decision = null;
    this.computeMs = 0;
    this.activeMs = 0;
    this.runningSince = null;
    this.stopAfterIteration = false;
    this.recordSample();
  }

  private setRunning() {
    this.status = 'running';
    if (this.runningSince === null) this.runningSince = this.now();
  }

  /** Cancels scheduled ticks and stops the running clock. */
  private halt() {
    this.cancelTick?.();
    this.cancelTick = null;
    if (this.runningSince !== null) {
      this.activeMs += this.now() - this.runningSince;
      this.runningSince = null;
    }
  }

  private scheduleTick(delay: number) {
    this.cancelTick?.();
    this.cancelTick = this.scheduler.schedule(() => {
      this.cancelTick = null;
      this.tick();
    }, delay);
  }

  private tick() {
    if (this.status !== 'running') return;
    const t0 = this.now();
    const animated = (this.detailed || this.stopAfterIteration) && this.speed !== 'turbo';
    let delay: number;
    if (animated) {
      const event = this.advance();
      delay = EVENT_DELAY[this.speed as Exclude<AnimationSpeed, 'turbo'>];
      if (event?.type === 'iteration-complete' && this.stopAfterIteration) {
        this.computeMs += this.now() - t0;
        this.afterManualStep();
        return;
      }
    } else if (this.speed === 'turbo') {
      do this.runOneIteration();
      while (this.remaining > 0 && this.now() - t0 < TURBO_BUDGET_MS);
      delay = 0;
    } else {
      const { iterations, delay: d } = BATCH[this.speed];
      if (this.inFlight) this.finishInFlight();
      for (let i = 0; i < iterations && this.remaining > 0; i++) this.runOneIteration();
      delay = d;
    }
    this.computeMs += this.now() - t0;

    if (this.remaining === 0 && !this.inFlight) {
      this.complete();
      return;
    }
    this.notify();
    this.scheduleTick(delay);
  }

  private afterManualStep() {
    this.stopAfterIteration = false;
    this.halt();
    if (this.remaining === 0 && !this.inFlight) {
      this.complete();
      return;
    }
    this.status = 'paused';
    this.notify();
  }

  /** Pulls the next event of the current (or a new) iteration. */
  private advance(): SearchEvent | null {
    if (!this.inFlight) {
      if (this.remaining === 0) return null;
      this.inFlight = this.tree.iterate();
    }
    const step = this.inFlight.next();
    if (step.done) {
      this.inFlight = null;
      return null;
    }
    this.handle(step.value);
    if (step.value.type === 'iteration-complete') {
      this.inFlight.next(); // let the generator return
      this.inFlight = null;
    }
    return step.value;
  }

  private finishInFlight() {
    while (this.inFlight) this.advance();
  }

  private runOneIteration() {
    do this.advance();
    while (this.inFlight);
  }

  private handle(event: SearchEvent) {
    this.pushLog({ seq: ++this.seq, kind: 'event', event });
    const a = this.activity;
    switch (event.type) {
      case 'selection':
        if (a.iteration !== event.iteration) this.activity = { ...idleActivity(), iteration: event.iteration };
        Object.assign(this.activity, { phase: 'selection', path: event.path, currentNodeId: event.chosenId });
        break;
      case 'selection-end':
        if (a.iteration !== event.iteration) this.activity = { ...idleActivity(), iteration: event.iteration };
        Object.assign(this.activity, { phase: 'selection', path: event.path, currentNodeId: event.nodeId });
        break;
      case 'expansion':
        Object.assign(a, { phase: 'expansion', path: event.path, currentNodeId: event.nodeId, expandedNodeId: event.nodeId });
        break;
      case 'simulation':
        Object.assign(a, { phase: 'simulation', currentNodeId: event.nodeId, simulation: { nodeId: event.nodeId, result: event.result } });
        break;
      case 'backpropagation':
        Object.assign(a, { phase: 'backpropagation', currentNodeId: event.nodeId, backpropIds: event.updated });
        break;
      case 'iteration-complete':
        a.phase = 'done';
        a.currentNodeId = null;
        if (event.iteration % this.sampleEvery === 0) this.recordSample();
        break;
    }
  }

  private recordSample() {
    const t = this.tree;
    const perspective = t.rootPlayer;
    const last = this.samples[this.samples.length - 1];
    if (last && last.iteration === t.iterations) return;
    this.samples.push({
      iteration: t.iterations,
      nodeCount: t.nodeCount,
      maxDepth: t.maxDepth,
      totals: { ...t.rolloutTotals },
      moves: t.root.children.map((c) => ({
        move: c.move as Move,
        visits: c.visits,
        winRate: c.visits > 0 ? c.outcomes[perspective] / c.visits : null,
      })),
    });
    if (this.samples.length > MAX_SAMPLES) {
      // Keep the first and every other sample; halve the sampling frequency.
      this.samples = this.samples.filter((_, i) => i % 2 === 0);
      this.sampleEvery *= 2;
    }
  }

  private complete() {
    this.halt();
    this.status = 'completed';
    this.recordSample();
    this.decision = this.tree.decide();
    this.activity.phase = 'done';
    const d = this.decision;
    this.system(
      'DECISION',
      d.move !== null
        ? `A busca terminou e a jogada foi escolhida pela política final (mais visitas: ${d.visits}).`
        : 'A busca terminou sem jogada possível.',
    );
    this.notify();
    this.onComplete?.(d);
  }

  private system(stage: Extract<LogEntry, { kind: 'system' }>['stage'], message: string) {
    this.pushLog({ seq: ++this.seq, kind: 'system', stage, iteration: this.tree.iterations, message });
  }

  private pushLog(entry: LogEntry) {
    this.log.push(entry);
    if (this.log.length > this.logLimit * 1.2) this.log = this.log.slice(-this.logLimit);
  }
}

export function clampConfig(config: MCTSConfig): MCTSConfig {
  const iterations = Math.round(Number.isFinite(config.iterations) ? config.iterations : MIN_ITERATIONS);
  const exploration = Number.isFinite(config.exploration) ? config.exploration : Math.SQRT2;
  return {
    ...config,
    iterations: Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, iterations)),
    exploration: Math.min(5, Math.max(0, exploration)),
  };
}
