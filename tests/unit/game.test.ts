import { describe, it, expect } from 'vitest';
import { levels } from '../../src/data/campaign';
import { validateLevel } from '../../src/game/schema';
import { Budget, strokeCells } from '../../src/game/budget';
import { SaveStore } from '../../src/game/saves';
describe('campaign data and fairness', () => {
  it('has ten ordered levels in every world, complete hints and bounded reference inputs', () => {
    expect(levels).toHaveLength(110);
    for (let w = 1; w <= 11; w++)
      expect(levels.filter((l) => l.world === w).map((l) => l.order)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
    for (const level of levels) {
      expect(validateLevel(level)).toEqual(level);
      const b = new Budget(level);
      for (const s of level.solution.events) expect(b.accept(s).accepted, level.id).toBe(true);
      expect(b.used).toBeLessThanOrEqual(level.toolkit.efficient);
    }
  });
  it('rejects broken links, dimensions, and malformed replay records', () => {
    for (const edit of [
      (l: (typeof levels)[number]) => (l.goals[0].rect[0] = -1),
      (l: (typeof levels)[number]) => (l.toolkit.budget = NaN),
      (l: (typeof levels)[number]) => (l.solution.events[0].radius = 100),
      (l: (typeof levels)[number]) =>
        l.machines.push({ id: 'bad', kind: 'gate', rect: [0, 0, 10, 10], sensor: 'missing' }),
    ]) {
      const l = structuredClone(levels[0]);
      edit(l);
      expect(() => validateLevel(l)).toThrow();
    }
  });
  it('charges actual square, circle, and line footprints and rejects out-of-area or over-budget placement', () => {
    const s = levels[0].solution.events[0];
    expect(strokeCells(s)).toBe(100);
    expect(strokeCells({ ...s, shape: 0 })).toBe(80);
    expect(strokeCells({ ...s, to: [s.to[0] + 10, s.to[1]] })).toBe(200);
    const budget = new Budget(levels[0]);
    expect(budget.accept({ ...s, from: [10, 10], to: [10, 10] }).accepted).toBe(false);
    expect(budget.used).toBe(0);
    expect(budget.accept(s).accepted).toBe(true);
    expect(budget.accept(s).accepted).toBe(false);
    expect(budget.used).toBe(100);
  });
  it('migrates progress, keeps best stars, handles corruption, and unlocks a coherent sequence', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    } as unknown as Storage;
    values.set(
      'granule-save',
      JSON.stringify({ version: 1, stars: { 'w1-01': 2 }, settings: { patterns: true } }),
    );
    const store = new SaveStore(storage);
    expect(store.data.version).toBe(2);
    expect(store.unlocked(1, 2, 'w1-01')).toBe(true);
    expect(store.unlocked(2, 1, 'w1-10')).toBe(false);
    store.award('w1-01', 1);
    expect(store.totalStars).toBe(2);
    for (const l of levels.slice(0, 100)) store.data.stars[l.id] = 3;
    for (const l of levels.slice(100)) expect(store.unlocked(l.world, l.order)).toBe(true);
    values.set('granule-save', '{broken');
    const recovered = new SaveStore(storage);
    expect(recovered.warning).toContain('could not be read');
    expect(recovered.totalStars).toBe(0);
  });
});
