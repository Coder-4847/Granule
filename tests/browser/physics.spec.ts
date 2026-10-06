import { test, expect } from '@playwright/test';
import { materials } from '../../src/data/materials';
import { mkdirSync, writeFileSync } from 'node:fs';

test('every table-defined contact reaction and phase transition runs on the GPU', async ({
  page,
}, testInfo) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  await page.evaluate(() => {
    window.granule.paused = true;
  });
  const cases = materials.flatMap((m) => [
    ...(m.reactions ?? []).map((r) => ({
      name: `${m.name} + ${materials[r.with].name}`,
      source: m.id,
      neighbor: r.with,
      target: r.to,
      temp: m.temperature,
      life: 500,
      neighborTemp: materials[r.with].temperature,
    })),
    ...(m.hot
      ? [
          {
            name: `${m.name}: hot transition`,
            source: m.id,
            neighbor: m.id,
            target: m.hot.to,
            temp: m.hot.at + 80,
            life: 500,
            neighborTemp: m.hot.at + 80,
          },
        ]
      : []),
    ...(m.cold
      ? [
          {
            name: `${m.name}: cold transition`,
            source: m.id,
            neighbor: m.id,
            target: m.cold.to,
            temp: m.cold.at - 40,
            life: 500,
            neighborTemp: m.cold.at - 40,
          },
        ]
      : []),
    ...(m.lifetime
      ? [
          {
            name: m.name + ': decay',
            source: m.id,
            neighbor: m.id,
            target: m.decayTo!,
            temp: m.temperature,
            neighborTemp: m.temperature,
            life: 1,
          },
        ]
      : []),
  ]);
  const results = await page.evaluate(async (cases) => {
    const engine = window.granule.engine,
      results = [];
    for (const c of cases) {
      engine.reset('empty');
      const data = await engine.read();
      for (let y = 100; y < 228; y++)
        for (let x = 100; x < 228; x++) {
          const i = (y * engine.width + x) * 4;
          data[i] = (x + y) % 2 ? c.source : c.neighbor;
          data[i + 1] = (x + y) % 2 ? c.temp : c.neighborTemp;
          data[i + 2] = c.life;
        }
      const count = (d: Float32Array, id: number) => {
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] === id) n++;
        return n;
      };
      const before = count(data, c.target);
      engine.upload(data);
      engine.step();
      const after = count(await engine.read(), c.target);
      results.push({ name: c.name, before, after, passed: after > before });
    }
    return results;
  }, cases);
  await testInfo.attach('reaction-coverage', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(results.filter((r) => !r.passed)).toEqual([]);
  mkdirSync('verification', { recursive: true });
  writeFileSync(
    'verification/phase2-reactions.json',
    JSON.stringify(
      { cases: results.length, passed: results.every((r) => r.passed), results },
      null,
      2,
    ) + '\n',
  );
});

test('fuel burns for a duration and produces its declared residue', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const fuels = materials
    .filter((m) => m.burnTicks)
    .map((m) => ({ id: m.id, ticks: m.burnTicks!, residue: m.residue!, temp: m.ignition! + 150 }));
  const results = await page.evaluate(async (fuels) => {
    const session = window.granule;
    session.paused = true;
    const engine = session.engine,
      results = [];
    for (const fuel of fuels) {
      engine.reset('empty');
      const data = await engine.read();
      for (let y = 15; y < 35; y++)
        for (let x = 30; x < 50; x++) {
          const i = (y * engine.width + x) * 4;
          data[i] = fuel.id;
          data[i + 1] = fuel.temp;
          data[i + 2] = 0;
        }
      engine.upload(data);
      engine.step();
      const first = await engine.read();
      let burning = 0;
      for (let i = 0; i < first.length; i += 4)
        if (first[i] === fuel.id && first[i + 2] < 0) burning++;
      for (let tick = 0; tick < fuel.ticks; tick++) {
        engine.step();
        if (tick % 32 === 0) await new Promise(requestAnimationFrame);
      }
      const end = await engine.read();
      let residue = 0;
      for (let i = 0; i < end.length; i += 4) if (end[i] === fuel.residue) residue++;
      results.push({ id: fuel.id, burning, residue });
    }
    return results;
  }, fuels);
  for (const r of results) {
    expect(r.burning, `fuel ${r.id} starts burning`).toBeGreaterThan(0);
    expect(r.residue, `fuel ${r.id} leaves residue`).toBeGreaterThan(0);
  }
});

test('pressure expands, destroys nearby matter, triggers chains, and preserves walls', async ({
  page,
}) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const s = window.granule;
    s.paused = true;
    const e = s.engine;
    e.reset('empty');
    const data = await e.read();
    const put = (x: number, y: number, id: number, temp = 20) => {
      const i = (y * e.width + x) * 4;
      data[i] = id;
      data[i + 1] = temp;
      data[i + 2] = 0;
    };
    for (let y = 20; y < 28; y++) for (let x = 20; x < 28; x++) put(x, y, 27, 400);
    for (let y = 20; y < 28; y++) for (let x = 31; x < 37; x++) put(x, y, 27);
    for (let y = 20; y < 28; y++) for (let x = 40; x < 42; x++) put(x, y, 20);
    e.upload(data);
    e.step();
    const first = await e.read('field');
    let distantStart = 0;
    for (let y = 10; y < 50; y++)
      for (let x = 40; x < 50; x++) distantStart += Math.abs(first[(y * e.width + x) * 4]);
    for (let i = 0; i < 30; i++) e.step();
    const end = await e.read(),
      field = await e.read('field');
    let tnt = 0,
      glass = 0,
      wall = 0,
      distantEnd = 0;
    for (let i = 0; i < end.length; i += 4) {
      if (end[i] === 27) tnt++;
      if (end[i] === 20) glass++;
      if (end[i] === 1) wall++;
    }
    for (let y = 10; y < 50; y++)
      for (let x = 40; x < 50; x++) distantEnd += Math.abs(field[(y * e.width + x) * 4]);
    return {
      tnt,
      glass,
      wall,
      distantStart,
      distantEnd,
      expectedWalls: 2 * 2 * e.width + 2 * 2 * (e.height - 4),
    };
  });
  expect(result.tnt).toBe(0);
  expect(result.glass).toBeLessThan(16);
  expect(result.wall).toBe(result.expectedWalls);
  expect(result.distantStart).toBe(0);
  expect(result.distantEnd).toBeGreaterThan(0);
});

test('a spark drives a traveling metal pulse and dry plant does not grow', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const e = window.granule.engine;
    window.granule.paused = true;
    e.reset('empty');
    const d = await e.read();
    const put = (x: number, y: number, id: number, temp = 20, life = 0) => {
      const i = (y * e.width + x) * 4;
      d[i] = id;
      d[i + 1] = temp;
      d[i + 2] = life;
    };
    for (let x = 20; x < 60; x++) put(x, 30, 19);
    put(19, 30, 31, 850, 8);
    for (let y = 50; y < 80; y++) {
      put(100, y, 18);
      put(150, y, 18);
      put(152, y, 4);
      put(153, y, 1);
    }
    for (let x = 149; x < 154; x++) put(x, 49, 1);
    e.upload(d);
    let maxFar = 0;
    for (let i = 0; i < 120; i++) {
      e.step();
      if (i < 50) {
        const field = await e.read('field');
        maxFar = Math.max(maxFar, field[(30 * e.width + 48) * 4 + 2]);
      }
      if (i % 20 === 0) await new Promise(requestAnimationFrame);
    }
    const end = await e.read();
    let dry = 0,
      wet = 0;
    for (let y = 40; y < 90; y++)
      for (let x = 90; x < 165; x++)
        if (end[(y * e.width + x) * 4] === 18) {
          if (x < 120) dry++;
          else wet++;
        }
    return { maxFar, dry, wet };
  });
  expect(result.maxFar).toBeGreaterThan(0.5);
  expect(result.dry).toBe(30);
  expect(result.wet).toBeGreaterThan(30);
});

test('physics bench, audio opt-in, reduced effects, and replay remain functional', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text());
  });
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  expect(await page.evaluate(() => window.granule.audio.state)).toBe('uninitialized');
  await page.locator('#sound').check();
  expect(await page.evaluate(() => window.granule.audio.state)).toBe('running');
  await page.locator('#diagnostics-toggle').click();
  await page.locator('#physics-bench').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/phase2-physics.png', fullPage: true });
  mkdirSync('verification', { recursive: true });
  await page.screenshot({ path: 'verification/phase2-physics.png', fullPage: true });
  await page.locator('#reduced-motion').check();
  await page.locator('#reduced-flashing').check();
  expect(
    await page.evaluate(
      () => window.granule.renderer.reducedMotion && window.granule.renderer.reducedFlashing,
    ),
  ).toBe(true);
  await page.locator('#sound').uncheck();
  expect(await page.evaluate(() => window.granule.audio.enabled)).toBe(false);
  const result = await page.evaluate(() => window.granule.verify());
  expect(result.identical).toBe(true);
  writeFileSync('verification/phase2-replay.json', JSON.stringify(result, null, 2) + '\n');
  await testInfo.attach('phase2-replay', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
