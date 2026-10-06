import { materials } from '../data/materials';
import type { Engine } from '../sim/engine';
import { sceneData } from '../sim/scenes';
import type { Stroke } from '../sim/replay';
import { Sensors, type Reading } from '../sim/sensors';
import { Budget } from './budget';
import { Machinery } from './machinery';
import type { Level, Stamp } from './schema';

export function levelData(level: Level) {
  const data = sceneData(960, 540, 'empty');
  const stamps: Stamp[] = [
    ...level.terrain,
    ...level.machines.filter((m) => m.kind === 'wire').map((m) => ({ rect: m.rect, material: 19 })),
  ];
  for (const s of stamps) {
    const [x, y, w, h] = s.rect,
      m = materials[s.material];
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const p = (j * 960 + i) * 4;
        data[p] = m.id;
        data[p + 1] = 'temperature' in s ? (s.temperature ?? m.temperature) : m.temperature;
        data[p + 2] = m.lifetime ?? 0;
        data[p + 3] = 0;
      }
  }
  return data;
}
export class Puzzle {
  budget: Budget;
  machinery: Machinery;
  private sensors: Sensors;
  readings: Record<string, Reading> = {};
  solved = false;
  failed = false;
  stars = 0;
  hints = 0;
  fireSeen = false;
  explosionSeen = false;
  events: Stroke[] = [];
  reached = new Set<string>();
  constructor(
    readonly engine: Engine,
    readonly level: Level,
  ) {
    if (engine.width !== 960 || engine.height !== 540)
      throw new Error('Campaign uses the verified 960 × 540 grid.');
    this.budget = new Budget(level);
    this.machinery = new Machinery(level.machines);
    this.sensors = new Sensors(engine);
    engine.reset('empty', level.seed);
    engine.upload(levelData(level));
    this.machinery.raster(engine);
  }
  place(s: Stroke) {
    if (this.solved || this.failed)
      return { accepted: false, reason: 'Restart to play again.', cost: 0 };
    const result = this.budget.accept(s);
    if (result.accepted) {
      this.engine.stroke(s);
      this.events.push(structuredClone(s));
      if (s.material === 6) this.fireSeen = true;
    }
    return result;
  }
  beforeStep() {
    this.machinery.raster(this.engine);
  }
  async sense() {
    this.readings = await this.sensors.sample([
      ...this.level.goals,
      ...this.level.sensors,
      { id: '__fire', material: 6, rect: [0, 0, 960, 540] },
      { id: '__blast', material: -1, rect: [0, 0, 960, 540] },
    ]);
    this.fireSeen ||= this.readings.__fire.count > 0;
    this.explosionSeen ||= this.readings.__blast.pressure > 1;
    this.machinery.sense(this.readings, this.engine);
    this.solved = this.level.goals
      .map((g) => {
        const value = this.readings[g.id][g.channel ?? 'count'];
        const met = g.comparison === 'at-most' ? value <= g.target : value >= g.target;
        if (met && g.latch) this.reached.add(g.id);
        return met || this.reached.has(g.id);
      })
      .every(Boolean);
    this.failed = !this.solved && this.engine.tick >= this.level.timeLimit;
    if (this.solved) {
      const bonus = this.level.bonus;
      const earned =
        bonus.kind === 'time'
          ? this.engine.tick <= bonus.limit
          : bonus.kind === 'no-fire'
            ? !this.fireSeen
            : !this.explosionSeen;
      this.stars =
        1 +
        Number(this.budget.used <= this.level.toolkit.efficient) +
        Number(earned && this.hints === 0);
    }
  }
  hint() {
    const hint = this.level.hints[Math.min(this.hints, 2)];
    this.hints++;
    return hint;
  }
  async advance(ticks = 6) {
    for (let i = 0; i < ticks && !this.solved && !this.failed; i++) {
      this.beforeStep();
      this.engine.step();
      if (this.engine.tick % 6 === 0) await this.sense();
    }
  }
  dispose() {
    this.sensors.dispose();
  }
}
