import { Engine } from '../sim/engine';
import { Renderer } from '../render/renderer';
import { PointerBrush } from '../tools/pointer';
import { stateHash, validateReplay, type Replay, type Stroke } from '../sim/replay';
import { AudioEngine } from '../audio/audio';
import { EventMeter } from '../sim/events';
import { Puzzle } from './runtime';
import { levels } from '../data/campaign';
import type { Level } from './schema';
import { validateLevel } from './schema';
import { Machinery } from './machinery';
import { Sensors } from '../sim/sensors';
import { packWorld, unpackWorld, type WorldSave } from './saves';
interface HistoryEntry {
  state: Float32Array;
  tick: number;
  replay: Replay;
  used: number;
  events: Stroke[];
  fire: boolean;
  explosion: boolean;
  machine?: ReturnType<Machinery['checkpoint']>;
}
export interface Benchmark {
  cells: number;
  width: number;
  height: number;
  frames: number;
  fps: number;
  p50ms: number;
  p95ms: number;
  renderer: string;
  lighting: boolean;
  ticksPerFrame: number;
  transportSubsteps: number;
  stressRefreshFrames: number;
  passed: boolean;
}
const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
export class Session {
  engine: Engine;
  renderer: Renderer;
  pointer: PointerBrush;
  paused = false;
  speed = 1;
  material = 3;
  radius = 12;
  shape: 0 | 1 = 0;
  tool: 0 | 1 | 2 = 0;
  overwrite = false;
  line = false;
  puzzle: Puzzle | null = null;
  puzzleReplay = false;
  replaySupported = true;
  sandboxBlueprint: Level | null = null;
  sandboxMachines: Machinery | null = null;
  private sandboxSensors: Sensors | null = null;
  private sensing = false;
  private generation = 0;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private lineStart: [number, number] | null = null;
  private pendingPlacement: Promise<void> | null = null;
  onGameChange: (() => void) | null = null;
  replay: Replay;
  busy = false;
  audio = new AudioEngine();
  private meter: EventMeter;
  frameTimes: number[] = [];
  private previousTime = 0;
  private accumulator = 0;
  private raf = 0;
  private disposed = false;
  private lastPaint = -1;
  private slowFrames = 0;
  onStatus: ((fps: number, tick: number) => void) | null = null;
  onNotice: ((text: string) => void) | null = null;
  constructor(canvas: HTMLCanvasElement, width = 960) {
    this.engine = new Engine(canvas, width, (width * 9) / 16);
    this.renderer = new Renderer(this.engine, canvas);
    this.meter = new EventMeter(this.engine);
    this.pointer = new PointerBrush(canvas, this.engine.width, this.engine.height);
    this.replay = this.newReplay('empty');
    this.raf = requestAnimationFrame(this.loop);
    this.pointer.onStart = () => {
      if (this.busy || this.sensing) return;
      if (this.line && this.pointer.point)
        this.lineStart = [this.pointer.point.x, this.pointer.point.y];
      else if (this.paused) this.pendingPlacement = this.rememberAndPaint();
      else this.paint();
    };
    this.pointer.onEnd = () => {
      if (!this.line || !this.lineStart || !this.pointer.point || this.busy || this.sensing) return;
      const stroke = this.pointerStroke();
      if (stroke) {
        stroke.from = this.lineStart;
        this.pendingPlacement = this.rememberAndPlace(stroke);
      }
      this.lineStart = null;
    };
  }
  private newReplay(scene: Replay['scene']): Replay {
    return {
      version: 1,
      physics: 2,
      width: this.engine.width,
      height: this.engine.height,
      seed: this.engine.seed,
      scene,
      ticks: 0,
      events: [],
    };
  }
  reset(scene: Replay['scene']) {
    if (this.busy) return;
    this.leaveGame();
    this.engine.reset(scene);
    this.renderer.particles.reset();
    this.audio.activity([0, 0, 0, 0]);
    this.replay = this.newReplay(scene);
    this.accumulator = 0;
    this.lastPaint = -1;
  }
  paint() {
    if (this.line || this.sensing) return;
    const stroke = this.pointerStroke();
    if (!stroke) return;
    this.place(stroke);
    this.pointer.previous = this.pointer.point ? { ...this.pointer.point } : null;
  }
  private pointerStroke(): Stroke | null {
    const p = this.pointer;
    if (!p.down || !p.point) return null;
    const from = p.previous ?? p.point;
    const stroke: Stroke = {
      tick: this.engine.tick,
      from: [from.x, from.y],
      to: [p.point.x, p.point.y],
      radius: this.radius,
      material: p.erase ? 0 : this.material,
      shape: this.shape,
      tool: p.erase ? 0 : this.tool,
      overwrite: this.overwrite,
    };
    return stroke;
  }
  place(stroke: Stroke) {
    if (this.puzzle) {
      const result = this.puzzle.place(stroke);
      if (!result.accepted) {
        this.onNotice?.(result.reason);
        return false;
      }
    } else this.engine.stroke(stroke);
    this.replay.events.push(structuredClone(stroke));
    this.redoStack = [];
    this.onGameChange?.();
    return true;
  }
  private async historyEntry(): Promise<HistoryEntry> {
    const metadata = {
      tick: this.engine.tick,
      replay: structuredClone(this.replay),
      used: this.puzzle?.budget.used ?? 0,
      events: structuredClone(this.puzzle?.events ?? []),
      fire: this.puzzle?.fireSeen ?? false,
      explosion: this.puzzle?.explosionSeen ?? false,
      machine: (this.puzzle?.machinery ?? this.sandboxMachines)?.checkpoint(),
    };
    return { ...metadata, state: await this.engine.snapshot() };
  }
  private async rememberAndPaint() {
    const stroke = this.pointerStroke();
    if (stroke) await this.rememberAndPlace(stroke);
  }
  private async rememberAndPlace(stroke: Stroke) {
    if (this.busy || this.sensing) return;
    this.busy = true;
    try {
      // The PBO copies are issued before this stroke; their fences complete later.
      const previous = this.paused ? this.historyEntry() : null;
      this.place(stroke);
      if (previous) {
        this.undoStack.push(await previous);
        if (this.undoStack.length > 4) this.undoStack.shift();
      }
    } catch (error) {
      this.onNotice?.(String(error));
    } finally {
      this.busy = false;
      this.pendingPlacement = null;
    }
  }
  async undo(redo = false) {
    if (this.busy || this.sensing) return;
    if (!this.paused) {
      this.onNotice?.('Pause before undoing a placement.');
      return;
    }
    const source = redo ? this.redoStack : this.undoStack,
      destination = redo ? this.undoStack : this.redoStack;
    const entry = source.at(-1);
    if (!entry || entry.tick !== this.engine.tick || this.puzzle?.solved) {
      this.onNotice?.('Undo is available for paused placements before time advances.');
      return;
    }
    this.busy = true;
    try {
      destination.push(await this.historyEntry());
      source.pop();
      this.engine.restore(entry.state);
      this.engine.tick = entry.tick;
      this.replay = entry.replay;
      if (this.puzzle) {
        this.puzzle.budget.used = entry.used;
        this.puzzle.events = entry.events;
        this.puzzle.fireSeen = entry.fire;
        this.puzzle.explosionSeen = entry.explosion;
      }
      if (entry.machine) (this.puzzle?.machinery ?? this.sandboxMachines)?.restore(entry.machine);
      this.renderer.particles.reset();
      this.onGameChange?.();
    } finally {
      this.busy = false;
    }
  }
  private leaveGame() {
    this.puzzleReplay = false;
    this.replaySupported = true;
    this.generation++;
    this.puzzle?.dispose();
    this.puzzle = null;
    this.sandboxSensors?.dispose();
    this.sandboxSensors = null;
    this.sandboxMachines = null;
    this.sandboxBlueprint = null;
    this.sensing = false;
    this.undoStack = [];
    this.redoStack = [];
    this.onGameChange?.();
  }
  loadLevel(level: Level) {
    if (this.busy) return;
    this.leaveGame();
    this.puzzle = new Puzzle(this.engine, validateLevel(level));
    this.replay = { ...this.newReplay('empty'), level: level.id };
    this.paused = true;
    this.material = level.toolkit.materials[0];
    this.tool = level.toolkit.tools.includes(0) ? 0 : (level.toolkit.tools[0] as 1 | 2);
    this.radius = Math.min(5, level.toolkit.radius);
    this.overwrite = false;
    this.renderer.particles.reset();
    this.onGameChange?.();
  }
  setSandboxBlueprint(level: Level, checkpoint?: ReturnType<Machinery['checkpoint']>) {
    if (this.sensing)
      throw new Error('Wait for the current sensor reading before changing machinery.');
    if (this.puzzle) throw new Error('Switch to sandbox before editing machinery.');
    const valid = validateLevel(level);
    this.replaySupported = false;
    const previous = this.sandboxMachines?.checkpoint();
    this.sandboxSensors?.dispose();
    this.sandboxBlueprint = valid;
    this.sandboxMachines = new Machinery(valid.machines);
    this.sandboxSensors = new Sensors(this.engine);
    if (checkpoint) this.sandboxMachines.restore(checkpoint);
    else {
      if (previous) {
        for (const machine of valid.machines)
          if (previous.states[machine.id])
            this.sandboxMachines.states[machine.id] = previous.states[machine.id];
        this.sandboxMachines.restore({
          states: this.sandboxMachines.states,
          footprint: previous.footprint,
        });
      }
      this.sandboxMachines.raster(this.engine);
    }
    this.onGameChange?.();
  }
  async saveWorld(): Promise<WorldSave> {
    await this.pendingPlacement;
    if (this.busy || this.sensing) throw new Error('Wait for the current GPU operation to finish.');
    this.busy = true;
    try {
      return await packWorld(
        await this.engine.snapshot(),
        this.engine.width,
        this.engine.tick,
        this.engine.seed,
        this.sandboxBlueprint,
        this.sandboxMachines?.checkpoint(),
      );
    } finally {
      this.busy = false;
    }
  }
  async loadWorld(value: unknown) {
    if (this.busy || this.sensing) throw new Error('Wait for the current GPU operation to finish.');
    this.busy = true;
    try {
      const { world, state } = await unpackWorld(value);
      if (world.width !== this.engine.width)
        throw new Error(`Select ${world.width} resolution before loading this world.`);
      this.leaveGame();
      this.engine.restore(state);
      this.engine.tick = world.tick;
      this.engine.seed = world.seed;
      this.replay = this.newReplay('empty');
      this.paused = true;
      this.renderer.particles.reset();
      this.replaySupported = false;
      if (world.blueprint) this.setSandboxBlueprint(world.blueprint, world.mechanics);
      this.onGameChange?.();
    } finally {
      this.busy = false;
    }
  }
  step() {
    if (this.busy || this.sensing || this.puzzle?.solved || this.puzzle?.failed) return;
    this.paint();
    this.puzzle?.beforeStep();
    this.sandboxMachines?.raster(this.engine);
    this.engine.step();
    this.replay.ticks = this.engine.tick;
    if (this.engine.tick % 6 === 0 && (this.puzzle || this.sandboxMachines)) {
      const generation = this.generation;
      this.sensing = true;
      const sample = this.puzzle
        ? this.puzzle.sense()
        : this.sandboxSensors!.sample(this.sandboxBlueprint!.sensors).then((readings) => {
            if (generation === this.generation) this.sandboxMachines?.sense(readings, this.engine);
          });
      void sample
        .then(() => {
          if (generation !== this.generation) return;
          if (this.puzzle?.solved || this.puzzle?.failed) this.paused = true;
          this.onGameChange?.();
        })
        .catch((error) => {
          if (generation === this.generation) {
            this.paused = true;
            this.onNotice?.(String(error));
          }
        })
        .finally(() => {
          if (generation === this.generation) this.sensing = false;
        });
    }
  }
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.previousTime ? now - this.previousTime : 16.667;
    this.previousTime = now;
    if (this.busy || document.hidden || this.engine.gl.isContextLost()) {
      this.audio.activity([0, 0, 0, 0]);
      this.accumulator = 0;
      return;
    }
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (!this.paused) {
      this.accumulator += Math.min(dt, 100) * this.speed;
      let steps = 0;
      while (this.accumulator >= 1000 / 60 && steps < 3) {
        this.step();
        this.accumulator -= 1000 / 60;
        steps++;
      }
      if (steps === 3) this.accumulator = 0;
    } else if (this.pointer.down && now - this.lastPaint > 16) {
      this.paint();
      this.lastPaint = now;
    }
    this.renderer.draw();
    if (this.audio.enabled) {
      if (this.paused) this.audio.activity([0, 0, 0, 0]);
      else {
        const levels = this.meter.poll(now);
        if (levels) this.audio.activity(levels);
      }
    }
    if (this.engine.tick % 15 === 0)
      this.onStatus?.(
        1000 / (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length),
        this.engine.tick,
      );
    this.slowFrames = dt > 24 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 180 && this.renderer.lighting) {
      this.renderer.lighting = false;
      this.renderer.particles.quality = 0.25;
      this.onNotice?.('Lighting reduced to keep the simulation responsive.');
      this.slowFrames = 0;
    }
  };
  async play(value: unknown): Promise<string> {
    if (this.busy) throw new Error('A diagnostic is already running.');
    const replay = validateReplay(value);
    if (replay.width !== this.engine.width)
      throw new Error(
        `Select ${replay.width} × ${replay.height} quality before loading this replay.`,
      );
    this.busy = true;
    this.paused = true;
    try {
      this.leaveGame();
      this.puzzleReplay = !!replay.level;
      if (replay.level) {
        const level = levels.find((l) => l.id === replay.level);
        if (!level) throw new Error('Unknown campaign replay.');
        this.puzzle = new Puzzle(this.engine, level);
      } else this.engine.reset(replay.scene, replay.seed);
      this.renderer.particles.reset();
      let event = 0;
      for (let tick = 0; tick <= replay.ticks; tick++) {
        while (event < replay.events.length && replay.events[event].tick === tick) {
          const stroke = replay.events[event++];
          if (this.puzzle) {
            if (!this.puzzle.place(stroke).accepted)
              throw new Error('Replay exceeds the level toolkit or budget.');
          } else this.engine.stroke(stroke);
        }
        if (tick < replay.ticks) {
          if (this.puzzle) await this.puzzle.advance(1);
          else this.engine.step();
        }
        if (tick % 16 === 0) {
          this.renderer.draw();
          await frame();
        }
      }
      this.replay = replay;
      this.renderer.draw();
      return stateHash(await this.engine.snapshot());
    } finally {
      this.busy = false;
      this.accumulator = 0;
      this.onGameChange?.();
    }
  }
  async verify() {
    if (this.pendingPlacement) await this.pendingPlacement;
    if (!this.replaySupported)
      throw new Error(
        'Use a world export for saved or edited worlds. Input replay verification starts from a built-in scene or campaign level.',
      );
    if (this.busy) throw new Error('A diagnostic is already running.');
    this.paused = true;
    const replay = structuredClone(this.replay);
    replay.ticks = this.engine.tick;
    this.busy = true;
    let recorded: string;
    try {
      recorded = stateHash(await this.engine.snapshot());
    } finally {
      this.busy = false;
    }
    const first = await this.play(replay),
      second = await this.play(replay);
    return {
      recorded,
      first,
      second,
      identical: recorded === first && first === second,
      ticks: replay.ticks,
      events: replay.events.length,
    };
  }
  async benchmark(frames = 240): Promise<Benchmark> {
    if (this.busy) throw new Error('A diagnostic is already running.');
    if (!Number.isSafeInteger(frames) || frames < 1 || frames > 100000)
      throw new Error('Benchmark frame count must be between 1 and 100,000.');
    this.busy = true;
    const paused = this.paused;
    let snapshot: Float32Array | undefined;
    const tick = this.engine.tick;
    const seed = this.engine.seed;
    try {
      snapshot = await this.engine.snapshot();
      this.engine.reset('benchmark');
      const times: number[] = [];
      let last = await frame();
      for (let i = 0; i < frames + 30; i++) {
        if (i > 0 && i % 240 === 0) {
          this.engine.reset('benchmark');
          this.renderer.particles.reset();
        }
        this.engine.step();
        this.renderer.draw();
        if (this.audio.enabled) {
          const levels = this.meter.poll(performance.now());
          if (levels) this.audio.activity(levels);
        }
        const now = await frame();
        if (i >= 30) times.push(now - last);
        last = now;
      }
      const sorted = [...times].sort((a, b) => a - b),
        gl = this.engine.gl,
        info = gl.getExtension('WEBGL_debug_renderer_info');
      const fps = 1000 / (times.reduce((a, b) => a + b, 0) / times.length),
        p95ms = sorted[Math.floor(times.length * 0.95)];
      return {
        cells: this.engine.width * this.engine.height,
        width: this.engine.width,
        height: this.engine.height,
        frames,
        fps,
        p50ms: sorted[Math.floor(times.length * 0.5)],
        p95ms,
        renderer: String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
        lighting: this.renderer.lighting,
        ticksPerFrame: 1,
        transportSubsteps: 8,
        stressRefreshFrames: 240,
        passed: fps >= 59 && p95ms < 20,
      };
    } finally {
      if (snapshot) {
        this.engine.restore(snapshot);
        this.renderer.particles.reset();
        this.engine.tick = tick;
        this.engine.seed = seed;
      }
      this.paused = paused;
      this.busy = false;
      this.accumulator = 0;
    }
  }
  halt() {
    this.disposed = true;
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.pointer.dispose();
    this.audio.foreground = false;
    this.audio.updateVolumes();
  }
  dispose() {
    this.leaveGame();
    this.halt();
    this.renderer.dispose();
    this.audio.dispose();
    this.meter.dispose();
    this.engine.dispose();
  }
}
