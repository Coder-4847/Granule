import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  await page.addInitScript(() => {
    const counters = {};
    window.resourceCounts = counters;
    for (const kind of [
      'Texture',
      'Buffer',
      'Framebuffer',
      'Program',
      'Shader',
      'VertexArray',
      'Sync',
    ]) {
      const proto = WebGL2RenderingContext.prototype,
        create = kind === 'Sync' ? 'fenceSync' : `create${kind}`,
        remove = `delete${kind}`,
        make = proto[create],
        drop = proto[remove],
        live = new WeakSet();
      counters[kind] = 0;
      proto[create] = function (...args) {
        const value = make.apply(this, args);
        if (value) {
          live.add(value);
          counters[kind]++;
        }
        return value;
      };
      proto[remove] = function (value) {
        if (value && live.has(value)) {
          live.delete(value);
          counters[kind]--;
        }
        return drop.call(this, value);
      };
    }
  });
  await page.routeWebSocket('**/*', () => {});
  await page.goto('http://127.0.0.1:5173/?lab');
  await page.waitForFunction(() => !!window.granule);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const samples = [],
    started = Date.now(),
    duration = Number(process.env.GRANULE_SOAK_MS || 600000);
  await page.evaluate(() => {
    window.granule.paused = true;
    window.granule.reset('empty');
  });
  let iteration = 0;
  while (Date.now() - started < duration) {
    await page.evaluate(async (i) => {
      const s = window.granule,
        { levels } = await import('/src/data/campaign.ts');
      if (i % 20 === 0) {
        s.loadLevel(levels[(((i / 20) * 9) % 110) | 0]);
        for (const stroke of s.puzzle.level.solution.events.filter((e) => e.tick === 0))
          s.place(stroke);
      }
      if (s.puzzle) await s.puzzle.advance(30);
      if (i % 60 === 59) {
        s.reset('empty');
        const world = await s.saveWorld();
        await s.loadWorld(world);
      }
      s.renderer.draw();
    }, iteration);
    if (iteration % 60 === 0) {
      await cdp.send('HeapProfiler.collectGarbage');
      samples.push({
        elapsedMs: Date.now() - started,
        heap: (await cdp.send('Runtime.getHeapUsage')).usedSize,
        resources: await page.evaluate(() => window.resourceCounts),
      });
    }
    iteration++;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    window.granule.reset('empty');
    window.granule.paused = true;
  });
  await page.waitForTimeout(100);
  await cdp.send('HeapProfiler.collectGarbage');
  const final = {
    heap: (await cdp.send('Runtime.getHeapUsage')).usedSize,
    resources: await page.evaluate(() => window.resourceCounts),
  };
  assert.deepEqual(errors, []);
  assert.ok(final.heap - samples[0].heap < 32 * 1024 * 1024, 'Retained JS heap grew by over 32 MB');
  assert.equal(final.resources.Sync, 0);
  assert.equal(final.resources.Shader, 0);
  // The first sample includes campaign sensors; final sandbox must own no more resources.
  for (const k of ['Texture', 'Buffer', 'Framebuffer', 'Program', 'VertexArray'])
    assert.ok(final.resources[k] <= samples[0].resources[k], `Leaked ${k}`);
  await writeFile(
    'verification/phase4-soak.json',
    JSON.stringify(
      {
        passed: true,
        durationMs: Date.now() - started,
        iterations: iteration,
        samples,
        final,
        consoleErrorsOrWarnings: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `Soak passed: ${iteration} iterations, ${Math.round((Date.now() - started) / 1000)} seconds; no retained GPU resource growth.`,
  );
} finally {
  await browser.close();
}
