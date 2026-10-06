import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test.beforeEach(async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
});
test('GPU sensor reductions exactly match cell counts and field maxima', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/src/sim/sensors.ts';
    const { Sensors } = (await import(path)) as typeof import('../../src/sim/sensors');
    const s = window.granule;
    s.paused = true;
    s.reset('empty');
    s.engine.stroke({
      tick: 0,
      from: [120, 100],
      to: [170, 115],
      radius: 8,
      material: 4,
      shape: 0,
      tool: 0,
      overwrite: false,
    });
    const zones = Array.from({ length: 32 }, (_, i) => ({
      id: `z${i}`,
      rect: [100 + i, 80, 73, 49] as [number, number, number, number],
      material: i % 2 === 0 ? 4 : -1,
    }));
    const meter = new Sensors(s.engine),
      gpu = await meter.sample(zones),
      state = await s.engine.read();
    const cpu = zones.map((z) => {
      let count = 0;
      for (let y = z.rect[1]; y < z.rect[1] + z.rect[3]; y++)
        for (let x = z.rect[0]; x < z.rect[0] + z.rect[2]; x++) {
          const m = state[(y * 960 + x) * 4];
          if (z.material === -1 ? m > 0 : m === z.material) count++;
        }
      return count;
    });
    meter.dispose();
    return { gpu: zones.map((z) => gpu[z.id].count), cpu };
  });
  expect(result.gpu).toEqual(result.cpu);
});
test('paused placement undo/redo and compressed world slots preserve complete GPU state', async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = window.granule;
    s.reset('empty');
    s.paused = true;
  });
  const initial = await page.evaluate(async () => {
    const path = '/src/sim/replay.ts';
    const { stateHash } = (await import(path)) as typeof import('../../src/sim/replay');
    return stateHash(await window.granule.engine.snapshot());
  });
  const canvas = page.locator('#world');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.waitForFunction(() => !window.granule.busy && window.granule.replay.events.length > 0);
  const placed = await page.evaluate(async () => (await window.granule.saveWorld()).hash);
  expect(placed).not.toBe(initial);
  await page.locator('#undo-world').click();
  await page.waitForFunction(() => !window.granule.busy);
  expect(await page.evaluate(async () => (await window.granule.saveWorld()).hash)).toBe(initial);
  await page.locator('#redo-world').click();
  await page.waitForFunction(() => !window.granule.busy);
  expect(await page.evaluate(async () => (await window.granule.saveWorld()).hash)).toBe(placed);
  await page.locator('#save-world').click();
  await expect(page.locator('#notice')).toContainText('World saved');
  await page.locator('#clear').click();
  await page.locator('#load-world').click();
  await expect(page.locator('#notice')).toContainText('World restored');
  expect(await page.evaluate(async () => (await window.granule.saveWorld()).hash)).toBe(placed);
  await page.reload();
  await page.waitForFunction(() => !!window.granule);
  await page.locator('#load-world').click();
  await expect(page.locator('#notice')).toContainText('World restored');
  expect(await page.evaluate(async () => (await window.granule.saveWorld()).hash)).toBe(placed);
});
test('level HUD enforces toolkit, records hints, awards stars and unlocks the next level', async ({
  page,
}) => {
  await page.locator('#campaign-level').selectOption('w1-02');
  await expect(page.locator('#play-level')).toBeDisabled();
  await page.locator('#campaign-level').selectOption('w1-01');
  await page.locator('#play-level').click();
  await expect(page.locator('[data-material="4"]')).toBeDisabled();
  await expect(page.locator('#quality')).toBeDisabled();
  await page.locator('#level-hint').click();
  await expect(page.locator('#hint-text')).toContainText('forfeits');
  await page.locator('#shape').selectOption('1');
  // A partially visible canvas must not scroll when focused and shift the stroke.
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    window.scrollTo(0, canvas.getBoundingClientRect().top + scrollY - 600);
  });
  const bounds = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    bounds.x + (bounds.width * 450) / 960,
    bounds.y + bounds.height * (1 - 260 / 540),
  );
  await expect(page.locator('#budget-status')).toContainText('100 / 135');
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click();
  await page.waitForFunction(() => window.granule.puzzle?.solved);
  await expect(page.locator('#budget-status')).toContainText('Complete ★★☆');
  await page.locator('#next-level').click();
  await expect(page.locator('#level-title')).toHaveText('Heavy rain');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('granule-save')!).stars['w1-01']),
  ).toBe(2);
});
test('campaign machinery replay is deterministic and compressed moving parts resume exactly', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const p = '/src/data/campaign.ts';
    const { levels } = (await import(p)) as typeof import('../../src/data/campaign');
    const level = levels.find((l) => l.id === 'w5-02')!,
      s = window.granule;
    const replay = {
      version: 1 as const,
      physics: 2 as const,
      width: 960,
      height: 540,
      seed: level.seed,
      scene: 'empty' as const,
      ticks: 120,
      events: level.solution.events,
      level: level.id,
    };
    const first = await s.play(replay),
      second = await s.play(replay);
    s.reset('empty');
    s.paused = true;
    s.setSandboxBlueprint(level);
    s.engine.stroke(level.solution.events[0]);
    s.sandboxMachines!.sense(
      Object.fromEntries(
        level.sensors.map((z) => [z.id, { count: 999, temperature: 20, charge: 0, pressure: 0 }]),
      ),
      s.engine,
    );
    for (let i = 0; i < 10; i++) s.sandboxMachines!.raster(s.engine);
    const world = await s.saveWorld();
    s.reset('empty');
    await s.loadWorld(world);
    const restored = await s.saveWorld();
    return {
      first,
      second,
      world: world.hash,
      restored: restored.hash,
      mechanics: JSON.stringify(world.mechanics) === JSON.stringify(restored.mechanics),
      position: Object.values(restored.mechanics!.states)[0].position,
    };
  });
  expect(result.first).toBe(result.second);
  expect(result.world).toBe(result.restored);
  expect(result.mechanics).toBe(true);
  expect(result.position).toBeGreaterThan(0.3);
});
test('moving parts preserve indestructible terrain and clear only their owned cells', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const s = window.granule;
    s.paused = true;
    s.reset('empty');
    const e = s.engine;
    e.stroke({
      tick: 0,
      from: [110, 110],
      to: [110, 110],
      radius: 3,
      material: 1,
      shape: 1,
      tool: 0,
      overwrite: false,
    });
    e.rasterMachines([], [[100, 100, 20, 20]]);
    e.rasterMachines([[100, 100, 20, 20]], [[130, 100, 20, 20]]);
    const moved = await e.read();
    e.rasterMachines([[130, 100, 20, 20]], []);
    const cleared = await e.read();
    const at = (data: Float32Array, x: number, y: number) => data[(y * 960 + x) * 4];
    return {
      wall: at(cleared, 110, 110),
      vacated: at(moved, 102, 102),
      moved: at(moved, 135, 110),
      removed: at(cleared, 135, 110),
    };
  });
  expect(result).toEqual({ wall: 1, vacated: 0, moved: 1, removed: 0 });
});
test('ice bridge controls fail without freezing the load-bearing surface', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const a = '/src/data/campaign.ts',
      b = '/src/game/runtime.ts';
    const { levels } = (await import(a)) as typeof import('../../src/data/campaign');
    const { Puzzle } = (await import(b)) as typeof import('../../src/game/runtime');
    const s = window.granule;
    s.paused = true;
    s.busy = true;
    const l = levels.find((l) => l.id === 'w4-05')!,
      results = [];
    for (const material of [-1, 4]) {
      const p = new Puzzle(s.engine, l);
      if (material === 4) {
        const [x, y, w, h] = l.work[0],
          points: [number, number][] = [];
        for (let py = y + 1; py < y + h; py += 2)
          for (let px = x + 1; px < x + w; px += 2) points.push([px, py]);
        const count = Math.floor(l.toolkit.budget / 4);
        for (let i = 0; i < count; i++) {
          const point = points[Math.floor(((i + 0.5) * points.length) / count)];
          p.place({
            tick: 0,
            from: point,
            to: point,
            material: 4,
            tool: 0,
            radius: 1,
            shape: 1,
            overwrite: false,
          });
        }
      }
      while (!p.solved && !p.failed) await p.advance(6);
      results.push({
        id: l.id,
        control: material === -1 ? 'no-input' : 'uniform-4',
        solved: p.solved,
        used: p.budget.used,
        ticks: s.engine.tick,
      });
      p.dispose();
    }
    s.busy = false;
    return results;
  });
  writeFileSync('verification/phase3-ice-controls.json', JSON.stringify(result, null, 2));
  expect(result.every((r) => !r.solved)).toBe(true);
});
test('Master targets require simultaneous readings instead of remembered early pulses', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const a = '/src/data/campaign.ts',
      b = '/src/game/runtime.ts';
    const { levels } = (await import(a)) as typeof import('../../src/data/campaign');
    const { Puzzle } = (await import(b)) as typeof import('../../src/game/runtime');
    const s = window.granule;
    s.paused = true;
    s.busy = true;
    const l = structuredClone(levels.find((l) => l.id === 'w11-03')!);
    l.solution.events.find((e) => e.material === 4)!.tick = 500;
    l.solution.events.sort((a, b) => a.tick - b.tick);
    const p = new Puzzle(s.engine, l);
    let event = 0,
      pulseSeen = false,
      grown = false;
    const pulse = l.goals.find((g) => g.channel === 'charge')!,
      plant = l.goals.find((g) => g.material === 18)!;
    while (!p.solved && !p.failed) {
      while (event < l.solution.events.length && l.solution.events[event].tick === s.engine.tick)
        p.place(l.solution.events[event++]);
      await p.advance(1);
      pulseSeen ||= (p.readings[pulse.id]?.charge ?? 0) >= pulse.target;
      grown ||= (p.readings[plant.id]?.count ?? 0) >= plant.target;
    }
    const result = { solved: p.solved, pulseSeen, grown };
    p.dispose();
    s.busy = false;
    return result;
  });
  expect(result).toEqual({ solved: false, pulseSeen: true, grown: true });
});
test('authoring editor validates imports and line brush waits for release', async ({ page }) => {
  await page.evaluate(() => {
    window.granule.reset('empty');
    window.granule.paused = true;
  });
  await page.locator('#shape').selectOption('2');
  const b = (await page.locator('#world').boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.3);
  expect(await page.evaluate(() => window.granule.replay.events.length)).toBe(0);
  await page.mouse.up();
  await page.waitForFunction(() => !window.granule.busy && window.granule.replay.events.length > 0);
  const stroke = await page.evaluate(() => window.granule.replay.events[0]);
  expect(stroke.from[0]).toBeLessThan(stroke.to[0]);
  await page.locator('#sandbox-tools summary').click();
  await page.locator('#editor-open').click();
  await page.locator('#editor-capture').click();
  await expect(page.locator('#editor-status')).toContainText('captured');
  const json = JSON.parse(await page.locator('#editor-json').inputValue());
  expect(json.terrain.length).toBeGreaterThan(0);
  await page.locator('#editor-json').fill('{bad');
  await page.locator('#editor-apply').click();
  await expect(page.locator('#editor-status')).toContainText('SyntaxError');
});
test('corrupt progress recovers and malformed world data leaves the current scene intact', async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem('granule-save', 'broken'));
  await page.reload();
  await page.waitForFunction(() => !!window.granule);
  await expect(page.locator('#notice')).toContainText('could not be read');
  const result = await page.evaluate(async () => {
    const s = window.granule;
    s.paused = true;
    const world = await s.saveWorld();
    let rejected = false;
    try {
      await s.loadWorld({ ...world, data: 'AAAA' });
    } catch {
      rejected = true;
    }
    return { rejected, before: world.hash, after: (await s.saveWorld()).hash };
  });
  expect(result.rejected).toBe(true);
  expect(result.before).toBe(result.after);
});
