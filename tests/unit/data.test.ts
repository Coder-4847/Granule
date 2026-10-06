import { describe, it, expect } from 'vitest';
import { materials, materialGLSL } from '../../src/data/materials';
import { sceneData } from '../../src/sim/scenes';
import { validateReplay, stateHash, type Replay } from '../../src/sim/replay';
describe('material schema', () => {
  it('has contiguous ids and valid transformation targets', () => {
    materials.forEach((m, i) => {
      expect(m.id).toBe(i);
      expect(m.heatCapacity).toBeGreaterThan(0);
      for (const id of [m.burnTo, m.decayTo, m.hot?.to, m.cold?.to])
        if (id !== undefined) expect(materials[id]).toBeDefined();
    });
    expect(materialGLSL()).toContain('Property prop');
  });
  it('orders densities for sand settling and oil floating', () => {
    expect(materials[3].density).toBeGreaterThan(materials[4].density);
    expect(materials[4].density).toBeGreaterThan(materials[5].density);
    expect(materials[11].density).toBeLessThan(materials[0].density);
  });
});
describe('scenes and replay validation', () => {
  const replay: Replay = {
    version: 1,
    width: 960,
    height: 540,
    seed: 12345,
    scene: 'empty',
    ticks: 60,
    events: [],
  };
  it('builds a repeatable 518,400-cell initial scene', () => {
    const first = sceneData(960, 540, 'demo');
    expect(first.length).toBe(518400 * 4);
    expect(stateHash(first)).toBe(stateHash(sceneData(960, 540, 'demo')));
    expect(first[0]).toBe(1);
  });
  it('validates replay dimensions and bounded ticks', () => {
    expect(validateReplay(replay)).toEqual(replay);
    for (const change of [
      { width: 961 },
      { ticks: Infinity },
      { seed: -1 },
      { height: 539 },
      { version: 2 },
    ])
      expect(() => validateReplay({ ...replay, ...change })).toThrow();
  });
  it('rejects corrupt strokes and unordered inputs', () => {
    const event = {
      tick: 3,
      from: [10, 10],
      to: [30, 30],
      radius: 5,
      shape: 0,
      tool: 0,
      material: 3,
      overwrite: false,
    };
    expect(validateReplay({ ...replay, events: [event] }).events).toHaveLength(1);
    for (const change of [
      { radius: NaN },
      { material: 99 },
      { tick: 100 },
      { from: [-1, 0] },
      { to: null },
      { overwrite: 'yes' },
    ])
      expect(() => validateReplay({ ...replay, events: [{ ...event, ...change }] })).toThrow();
    expect(() => validateReplay({ ...replay, events: [event, { ...event, tick: 2 }] })).toThrow();
  });
});
