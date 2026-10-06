import { materials } from '../data/materials';
import type { Stroke } from '../sim/replay';
import type { Rect, Sensor } from '../sim/sensors';
export const machineKinds = [
  'collector',
  'gate',
  'piston',
  'wheel',
  'turbine',
  'float',
  'lever',
  'plate',
  'wire',
  'relay',
] as const;
export interface Machine {
  id: string;
  kind: (typeof machineKinds)[number];
  rect: Rect;
  sensor?: string;
  channel?: 'count' | 'temperature' | 'charge' | 'pressure';
  threshold?: number;
  comparison?: 'at-least' | 'at-most';
  travel?: [number, number];
  latch?: boolean;
  output?: [number, number];
}
export interface Goal extends Sensor {
  label: string;
  target: number;
  comparison?: 'at-least' | 'at-most';
  channel?: 'count' | 'temperature' | 'charge' | 'pressure';
  latch?: boolean;
  guard?: boolean;
}
export interface Stamp {
  rect: Rect;
  material: number;
  temperature?: number;
}
export interface Level {
  version: 1;
  id: string;
  world: number;
  order: number;
  title: string;
  lesson: string;
  seed: number;
  terrain: Stamp[];
  sensors: Sensor[];
  machines: Machine[];
  goals: Goal[];
  toolkit: {
    materials: number[];
    tools: (0 | 1 | 2 | 3)[];
    budget: number;
    efficient: number;
    radius: number;
  };
  // Drawing is permitted only in these work areas; objectives never overlap them.
  work: Rect[];
  timeLimit: number;
  bonus: { kind: 'time' | 'no-fire' | 'no-explosion'; limit: number };
  hints: [string, string, string];
  solution: { ticks: number; events: Stroke[] };
}
const fail = (message: string): never => {
  throw new Error(`Invalid level: ${message}`);
};
const integer = (v: unknown, min: number, max: number) =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
export function validateLevel(input: unknown): Level {
  if (!input || typeof input !== 'object') return fail('expected an object');
  const l = input as Level;
  if (
    l.version !== 1 ||
    typeof l.id !== 'string' ||
    !/^[a-z0-9-]{1,64}$/.test(l.id) ||
    !integer(l.world, 1, 11) ||
    !integer(l.order, 1, 10) ||
    !integer(l.seed, 0, 0xffffffff)
  )
    fail('identity');
  for (const v of [l.title, l.lesson, ...(Array.isArray(l.hints) ? l.hints : [])])
    if (typeof v !== 'string' || v.length > 1000) fail('text');
  if (!Array.isArray(l.hints) || l.hints.length !== 3) fail('three hints required');
  const rect = (r: unknown) => {
    if (
      !Array.isArray(r) ||
      r.length !== 4 ||
      !r.every((v) => integer(v, 0, 960)) ||
      r[2] < 1 ||
      r[3] < 1 ||
      r[0] + r[2] > 960 ||
      r[1] + r[3] > 540
    )
      fail('rectangle');
  };
  const material = (m: unknown) => {
    if (!integer(m, 0, materials.length - 1)) fail('material');
  };
  if (!Array.isArray(l.terrain) || l.terrain.length > 2000) fail('terrain');
  l.terrain.forEach((s) => {
    rect(s.rect);
    material(s.material);
    if (
      s.temperature !== undefined &&
      (!Number.isFinite(s.temperature) || s.temperature < -100 || s.temperature > 1800)
    )
      fail('temperature');
  });
  if (
    !Array.isArray(l.goals) ||
    !l.goals.length ||
    !Array.isArray(l.sensors) ||
    l.goals.length + l.sensors.length > 30
  )
    fail('zones');
  const ids = new Set<string>();
  for (const s of [...l.goals, ...l.sensors]) {
    if (typeof s.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(s.id) || ids.has(s.id))
      fail('sensor identity');
    ids.add(s.id);
    rect(s.rect);
    if (s.material !== -1) material(s.material);
  }
  for (const g of l.goals)
    if (
      typeof g.label !== 'string' ||
      g.label.length > 200 ||
      !Number.isFinite(g.target) ||
      g.target < 0 ||
      (g.comparison !== undefined && !['at-least', 'at-most'].includes(g.comparison)) ||
      (g.channel !== undefined &&
        !['count', 'temperature', 'charge', 'pressure'].includes(g.channel))
    )
      fail('goal');
  for (const g of l.goals)
    if (g.latch !== undefined && typeof g.latch !== 'boolean') fail('goal latch');
  for (const g of l.goals)
    if (g.guard !== undefined && typeof g.guard !== 'boolean') fail('goal guard');
  for (const g of l.goals)
    if (g.guard && (g.latch !== false || g.comparison !== 'at-most'))
      fail('guards must be live maximum constraints');
  if (!Array.isArray(l.machines) || l.machines.length > 32) fail('machinery');
  const machineIds = new Set<string>();
  for (const m of l.machines) {
    if (m.comparison !== undefined && !['at-least', 'at-most'].includes(m.comparison))
      fail('machine comparison');
    rect(m.rect);
    if (
      typeof m.id !== 'string' ||
      !/^[a-z0-9-]{1,64}$/.test(m.id) ||
      ['constructor', 'prototype'].includes(m.id) ||
      machineIds.has(m.id) ||
      !machineKinds.includes(m.kind) ||
      (m.sensor !== undefined && !ids.has(m.sensor)) ||
      (m.channel !== undefined &&
        !['count', 'temperature', 'charge', 'pressure'].includes(m.channel)) ||
      (m.threshold !== undefined && (!Number.isFinite(m.threshold) || m.threshold < 0)) ||
      (m.latch !== undefined && typeof m.latch !== 'boolean')
    )
      fail('machine');
    machineIds.add(m.id);
    if (m.travel !== undefined) {
      if (
        !Array.isArray(m.travel) ||
        m.travel.length !== 2 ||
        !m.travel.every((v) => integer(v, -960, 960))
      )
        fail('travel');
      rect([m.rect[0] + m.travel[0], m.rect[1] + m.travel[1], m.rect[2], m.rect[3]]);
    }
    if (
      m.output !== undefined &&
      (!Array.isArray(m.output) ||
        m.output.length !== 2 ||
        !integer(m.output[0], 2, 957) ||
        !integer(m.output[1], 2, 537))
    )
      fail('output');
  }
  const t = l.toolkit;
  if (
    !t ||
    !Array.isArray(t.materials) ||
    !t.materials.length ||
    !Array.isArray(t.tools) ||
    t.materials.some((m) => !integer(m, 1, materials.length - 1)) ||
    t.tools.some((v) => ![0, 1, 2, 3].includes(v)) ||
    !integer(t.budget, 1, 1000000) ||
    !integer(t.efficient, 1, t.budget) ||
    !integer(t.radius, 1, 60)
  )
    fail('toolkit');
  if (!Array.isArray(l.work) || !l.work.length || l.work.length > 32) fail('work areas');
  l.work.forEach(rect);
  if (
    !integer(l.timeLimit, 6, 36000) ||
    !l.bonus ||
    !['time', 'no-fire', 'no-explosion'].includes(l.bonus.kind) ||
    !Number.isFinite(l.bonus.limit)
  )
    fail('timing');
  if (
    !l.solution ||
    !integer(l.solution.ticks, 6, l.timeLimit) ||
    !Array.isArray(l.solution.events) ||
    l.solution.events.length > 10000
  )
    fail('solution');
  let previous = -1;
  for (const e of l.solution.events) {
    if (
      !integer(e.tick, 0, l.solution.ticks) ||
      e.tick < previous ||
      ![0, 1, 2].includes(e.tool) ||
      ![0, 1].includes(e.shape) ||
      typeof e.overwrite !== 'boolean' ||
      !integer(e.radius, 1, 60)
    )
      fail('stroke');
    material(e.material);
    previous = e.tick;
    for (const p of [e.from, e.to])
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        !p.every((v, i) => Number.isFinite(v) && v >= 0 && v <= (i === 0 ? 960 : 540))
      )
        fail('stroke point');
  }
  return structuredClone(l);
}
