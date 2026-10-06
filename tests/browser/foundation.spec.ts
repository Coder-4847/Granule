import { test, expect } from '@playwright/test';
test('default GPU scene, pointer controls, no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?lab');
  await expect(page.locator('#fallback')).toBeHidden();
  await page.waitForFunction(() => window.granule?.engine.tick > 3);
  expect(
    await page.evaluate(() => window.granule.engine.width * window.granule.engine.height),
  ).toBe(518400);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Clear canvas', exact: true }).click();
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas missing');
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  const count = await page.evaluate(async () => {
    const s = await window.granule.engine.read();
    let count = 0;
    for (let i = 0; i < s.length; i += 4) if (s[i] === 3) count++;
    return count;
  });
  expect(count).toBeGreaterThan(50);
  await page.getByRole('button', { name: 'New canvas' }).click();
  await page.screenshot({ path: 'test-results/foundation-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('GPU replay is bit-for-bit deterministic and transports conserve sand', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const s = window.granule;
    s.paused = true;
    const replay = {
      version: 1,
      width: 960,
      height: 540,
      seed: 7831,
      scene: 'empty',
      ticks: 45,
      events: [
        {
          tick: 0,
          from: [450, 400],
          to: [510, 400],
          radius: 12,
          material: 3,
          tool: 0,
          shape: 0,
          overwrite: false,
        },
        {
          tick: 4,
          from: [300, 350],
          to: [400, 350],
          radius: 10,
          material: 4,
          tool: 0,
          shape: 0,
          overwrite: false,
        },
      ],
    };
    await s.play({ ...replay, ticks: 0, events: replay.events.slice(0, 1) });
    const initial = await s.engine.read();
    const first = await s.play(replay),
      final = await s.engine.read(),
      second = await s.play(replay);
    const stats = (data: Float32Array) => {
      let count = 0,
        y = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] === 3) {
          count++;
          y += Math.floor(i / 4 / 960);
        }
      return { count, y: y / count };
    };
    return {
      first,
      second,
      initial: stats(initial),
      final: stats(final),
      error: s.engine.gl.getError(),
    };
  });
  expect(result.first).toBe(result.second);
  expect(result.initial.count).toBe(result.final.count);
  expect(result.final.y).toBeLessThan(result.initial.y - 20);
  expect(result.error).toBe(0);
});
test('GPU benchmark records the phase gate honestly', async ({ page }, testInfo) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const report = await page.evaluate(() => window.granule.benchmark(120));
  await testInfo.attach('gpu-benchmark', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  console.log('BENCHMARK', JSON.stringify(report));
  expect(report.cells).toBe(518400);
  expect(report.fps).toBeGreaterThan(0);
});
test('tablet layout and context recovery', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.selectOption('#quality', '480');
  await expect(page.locator('#dimensions')).toContainText('480 × 270');
  await page.evaluate(() => {
    const ext = window.granule.engine.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    setTimeout(() => ext?.restoreContext(), 1000);
  });
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#play-level')).toBeDisabled();
  await expect(page.locator('#fallback')).toBeHidden({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/foundation-tablet.png', fullPage: true });
});
test('hot water changes phase, immovable walls survive, oil sorts above water', async ({
  page,
}) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const s = window.granule;
    s.paused = true;
    s.reset('empty');
    const data = await s.engine.read(),
      w = s.engine.width;
    const put = (x: number, y: number, id: number, temp = 20) => {
      const i = (y * w + x) * 4;
      data[i] = id;
      data[i + 1] = temp;
    };
    for (let y = 10; y < 60; y++) for (let x = 10; x < 60; x++) put(x, y, y < 35 ? 5 : 4);
    for (let y = 8; y < 62; y++) {
      put(8, y, 1);
      put(61, y, 1);
    }
    for (let x = 8; x < 62; x++) {
      put(x, 8, 1);
      put(x, 61, 1);
    }
    for (let y = 100; y < 110; y++) for (let x = 100; x < 110; x++) put(x, y, 4, 150);
    s.engine.upload(data);
    s.engine.step();
    const early = await s.engine.read();
    let earlySteam = 0;
    for (let i = 0; i < early.length; i += 4) if (early[i] === 7) earlySteam++;
    let initialWall = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 1) initialWall++;
    for (let i = 0; i < 90; i++) {
      s.engine.step();
      if (i % 10 === 0) await new Promise(requestAnimationFrame);
    }
    const end = await s.engine.read();
    let oilY = 0,
      waterY = 0,
      oil = 0,
      water = 0,
      steam = 0,
      walls = 0;
    for (let y = 0; y < s.engine.height; y++)
      for (let x = 0; x < w; x++) {
        const id = end[(y * w + x) * 4];
        if (id === 7) steam++;
        if (id === 1) walls++;
        if (x >= 10 && x < 60 && y >= 10 && y < 60) {
          if (id === 5) {
            oil++;
            oilY += y;
          }
          if (id === 4) {
            water++;
            waterY += y;
          }
        }
      }
    return {
      oilY: oilY / oil,
      waterY: waterY / water,
      steam: Math.max(steam, earlySteam),
      walls,
      initialWall,
    };
  });
  expect(result.oilY).toBeGreaterThan(result.waterY);
  expect(result.steam).toBeGreaterThan(0);
  expect(result.walls).toBe(result.initialWall);
});
test('single clicks are recorded and a live recording replays exactly', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  await page.evaluate(() => {
    window.granule.paused = true;
    window.granule.reset('empty');
  });
  await page.locator('canvas').click({ position: { x: 150, y: 100 } });
  const result = await page.evaluate(() => window.granule.verify());
  expect(result.events).toBeGreaterThan(0);
  expect(result.identical).toBe(true);
});

test('benchmark preserves the scene, tick, and imported seed', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const session = window.granule;
    await session.play({
      version: 1,
      width: 960,
      height: 540,
      seed: 99871,
      scene: 'demo',
      ticks: 12,
      events: [],
    });
    await session.benchmark(5);
    const seed = session.engine.seed;
    session.step();
    return { seed, verification: await session.verify() };
  });
  expect(result.seed).toBe(99871);
  expect(result.verification.identical).toBe(true);
});
test('no WebGL gives a readable fallback and disables GPU controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]) === 'webgl2') return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/?lab');
  await expect(page.locator('#fallback')).toContainText('needs WebGL2');
  await expect(page.locator('#pause')).toBeDisabled();
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#help-dialog')).toBeVisible();
});
test('phone touch placement and malformed replay recovery', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  await page.evaluate(() => {
    window.granule.paused = true;
    window.granule.reset('empty');
  });
  await page.locator('canvas').tap({ position: { x: 160, y: 60 } });
  expect(await page.evaluate(() => window.granule.replay.events.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#diagnostics-toggle').click();
  await page.locator('#replay-file').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.locator('#report')).toContainText('Unsupported or invalid replay');
  await expect(page.locator('#verify')).toBeEnabled();
  await page.screenshot({ path: 'test-results/foundation-phone.png', fullPage: true });
  await context.close();
});
