import { materials } from '../data/materials';
import { stateHash } from '../sim/replay';
import { validateLevel, type Level } from './schema';
import type { Machinery } from './machinery';
export interface WorldSave {
  version: 1;
  width: number;
  height: number;
  tick: number;
  seed: number;
  hash: string;
  data: string;
  blueprint: Level | null;
  mechanics?: ReturnType<Machinery['checkpoint']>;
}
export interface Progress {
  version: 2;
  stars: Record<string, number>;
  settings: Record<string, string | boolean>;
  slots: Record<string, WorldSave>;
}
const empty = (): Progress => ({ version: 2, stars: {}, settings: {}, slots: {} });
const key = 'granule-save';
export class SaveStore {
  data: Progress = empty();
  warning = '';
  private storage: Storage | undefined;
  constructor(storage?: Storage) {
    try {
      this.storage = storage ?? localStorage;
      const raw = this.storage.getItem(key);
      if (!raw) return;
      const v = JSON.parse(raw) as Progress;
      if (!v || ![1, 2].includes(v.version) || typeof v.stars !== 'object' || !v.stars)
        throw new Error('Invalid save');
      for (const [id, n] of Object.entries(v.stars))
        if (/^[a-z0-9-]{1,64}$/.test(id) && Number.isInteger(n) && n >= 0 && n <= 3)
          this.data.stars[id] = n;
      if (v.settings && typeof v.settings === 'object')
        for (const [id, value] of Object.entries(v.settings))
          if (
            id.length < 64 &&
            (typeof value === 'boolean' || (typeof value === 'string' && value.length < 100))
          )
            this.data.settings[id] = value;
      if (v.slots && typeof v.slots === 'object')
        for (const slot of ['1', '2', '3'])
          if (v.slots[slot]) this.data.slots[slot] = validateWorld(v.slots[slot]);
    } catch {
      this.warning =
        'Saved data could not be read. A fresh session is ready; the original save is retained until you save again.';
    }
  }
  commit() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(key, JSON.stringify(this.data));
    } catch {
      throw new Error(
        'Browser storage is full or unavailable. Export this world to keep it safely.',
      );
    }
  }
  award(id: string, stars: number) {
    this.data.stars[id] = Math.max(this.data.stars[id] ?? 0, stars);
    this.commit();
  }
  get totalStars() {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }
  unlocked(world: number, order: number, previousId?: string) {
    return world === 11
      ? this.totalStars >= 100 + order * 10
      : (world === 1 && order === 1) || (!!previousId && (this.data.stars[previousId] ?? 0) > 0);
  }
}
export function validateWorld(value: unknown): WorldSave {
  if (!value || typeof value !== 'object') throw new Error('Not a Granule world.');
  const w = value as WorldSave;
  if (
    w.version !== 1 ||
    ![480, 720, 960].includes(w.width) ||
    w.height !== (w.width * 9) / 16 ||
    !Number.isSafeInteger(w.tick) ||
    w.tick < 0 ||
    w.tick > 100000000 ||
    !Number.isSafeInteger(w.seed) ||
    w.seed < 0 ||
    w.seed > 0xffffffff ||
    typeof w.hash !== 'string' ||
    !/^[0-9a-f]{8}$/.test(w.hash) ||
    typeof w.data !== 'string' ||
    w.data.length > 24000000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(w.data)
  )
    throw new Error('Invalid or unsupported world file.');
  if (w.blueprint) validateLevel(w.blueprint);
  if (w.mechanics) {
    if (
      !w.blueprint ||
      !Array.isArray(w.mechanics.footprint) ||
      w.mechanics.footprint.length > 32 ||
      !w.mechanics.states ||
      typeof w.mechanics.states !== 'object'
    )
      throw new Error('Invalid machinery checkpoint.');
    for (const rect of w.mechanics.footprint)
      if (
        !Array.isArray(rect) ||
        rect.length !== 4 ||
        !rect.every(Number.isSafeInteger) ||
        rect[0] < 0 ||
        rect[1] < 0 ||
        rect[2] < 1 ||
        rect[3] < 1 ||
        rect[0] + rect[2] > w.width ||
        rect[1] + rect[3] > w.height
      )
        throw new Error('Invalid moving part bounds.');
    for (const machine of w.blueprint.machines) {
      const s = w.mechanics.states[machine.id];
      if (
        !s ||
        typeof s.active !== 'boolean' ||
        !Number.isFinite(s.position) ||
        s.position < 0 ||
        s.position > 1 ||
        !Number.isSafeInteger(s.turns) ||
        s.turns < 0
      )
        throw new Error('Invalid moving part state.');
    }
  }
  return structuredClone(w);
}
export async function packWorld(
  state: Float32Array,
  width: number,
  tick: number,
  seed: number,
  blueprint: Level | null = null,
  mechanics?: ReturnType<Machinery['checkpoint']>,
): Promise<WorldSave> {
  const copy = new Uint8Array(state.byteLength);
  copy.set(new Uint8Array(state.buffer, state.byteOffset, state.byteLength));
  const compressed = new Uint8Array(
    await new Response(
      new Blob([copy]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer(),
  );
  let binary = '';
  for (let i = 0; i < compressed.length; i += 8192)
    binary += String.fromCharCode(...compressed.subarray(i, i + 8192));
  return {
    version: 1,
    width,
    height: (width * 9) / 16,
    tick,
    seed,
    hash: stateHash(state),
    data: btoa(binary),
    blueprint: structuredClone(blueprint),
    ...(mechanics ? { mechanics: structuredClone(mechanics) } : {}),
  };
}
export async function unpackWorld(value: unknown) {
  const world = validateWorld(value);
  const compressed = Uint8Array.from(atob(world.data), (c) => c.charCodeAt(0));
  const expected = world.width * world.height * 32;
  const bytes = new Uint8Array(expected);
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  let offset = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      if (offset + chunk.length > expected)
        throw new Error('World expands beyond its declared dimensions.');
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  } finally {
    await reader.cancel();
  }
  if (offset !== expected) throw new Error('World data is incomplete.');
  const state = new Float32Array(bytes.buffer);
  if (stateHash(state) !== world.hash) throw new Error('World checksum does not match.');
  const stateLength = state.length / 2;
  for (let i = 0; i < state.length; i++)
    if (
      !Number.isFinite(state[i]) ||
      Math.abs(state[i]) > 10000000 ||
      (i < stateLength &&
        i % 4 === 0 &&
        (!Number.isInteger(state[i]) || state[i] < 0 || state[i] >= materials.length))
    )
      throw new Error('World contains invalid cell data.');
  return { world, state };
}
