import { materials } from '../data/materials';
export interface Stroke {
  tick: number;
  from: [number, number];
  to: [number, number];
  radius: number;
  material: number;
  shape: 0 | 1;
  tool: 0 | 1 | 2;
  overwrite: boolean;
}
export interface Replay {
  version: 1;
  width: number;
  height: number;
  seed: number;
  scene: 'empty' | 'demo' | 'benchmark' | 'physics';
  physics?: 2;
  ticks: number;
  events: Stroke[];
  level?: string;
}
export function validateReplay(value: unknown): Replay {
  if (!value || typeof value !== 'object') throw new Error('Not a Granule replay.');
  const r = value as Replay;
  if (
    r.version !== 1 ||
    ![480, 720, 960].includes(r.width) ||
    r.height !== (r.width * 9) / 16 ||
    !Number.isSafeInteger(r.seed) ||
    r.seed < 0 ||
    r.seed > 0xffffffff ||
    !['empty', 'demo', 'benchmark', 'physics'].includes(r.scene) ||
    (r.physics !== undefined && r.physics !== 2) ||
    !Number.isSafeInteger(r.ticks) ||
    r.ticks < 0 ||
    r.ticks > 216000 ||
    !Array.isArray(r.events) ||
    r.events.length > 100000 ||
    (r.level !== undefined &&
      (typeof r.level !== 'string' || !/^w(?:[1-9]|10|11)-\d{2}$/.test(r.level)))
  )
    throw new Error('Unsupported or invalid replay.');
  let previous = -1;
  for (const e of r.events) {
    if (
      !e ||
      !Number.isSafeInteger(e.tick) ||
      e.tick < previous ||
      e.tick < 0 ||
      e.tick > r.ticks ||
      !Number.isInteger(e.material) ||
      e.material < 0 ||
      e.material >= materials.length ||
      ![0, 1].includes(e.shape) ||
      ![0, 1, 2].includes(e.tool) ||
      typeof e.overwrite !== 'boolean' ||
      !Number.isFinite(e.radius) ||
      e.radius < 1 ||
      e.radius > 80 ||
      ![e.from, e.to].every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((v, i) => Number.isFinite(v) && v >= 0 && v <= (i === 0 ? r.width : r.height)),
      )
    )
      throw new Error('Replay contains an invalid brush event.');
    previous = e.tick;
  }
  return structuredClone(r);
}
export function stateHash(state: Float32Array): string {
  const bytes = new Uint8Array(state.buffer, state.byteOffset, state.byteLength);
  let hash = 2166136261;
  for (const b of bytes) {
    hash ^= b;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
