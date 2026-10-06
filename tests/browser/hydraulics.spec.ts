import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test('connected columns rise toward the same level without material creation', async ({
  page,
}, testInfo) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const e = window.granule.engine;
    window.granule.paused = true;
    e.reset('empty');
    const data = await e.read();
    const rect = (x0: number, y0: number, x1: number, y1: number, id: number) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * e.width + x) * 4;
          data[i] = id;
          data[i + 1] = 20;
        }
    };
    rect(100, 38, 164, 40, 1);
    rect(100, 40, 102, 140, 1);
    rect(162, 40, 164, 140, 1);
    rect(112, 46, 152, 140, 1);
    rect(102, 40, 112, 124, 4);
    e.upload(data);
    for (let i = 0; i < 1500; i++) {
      e.step();
      if (i % 24 === 0) await new Promise(requestAnimationFrame);
    }
    const final = await e.read();
    let water = 0,
      rightHigh = 0,
      leftHigh = 0;
    for (let y = 0; y < e.height; y++)
      for (let x = 0; x < e.width; x++)
        if (final[(y * e.width + x) * 4] === 4) {
          water++;
          if (x >= 152 && x < 162) rightHigh = Math.max(rightHigh, y);
          if (x >= 102 && x < 112) leftHigh = Math.max(leftHigh, y);
        }
    const field = await e.read('field');
    return {
      water,
      rightHigh,
      leftHigh,
      heads: [108, 115, 135, 155].map((x) => field[(42 * e.width + x) * 4 + 3]),
    };
  });
  await page.evaluate(() => window.granule.renderer.draw());
  await page.screenshot({ path: 'test-results/connected-columns.png', fullPage: true });
  mkdirSync('verification', { recursive: true });
  writeFileSync(
    'verification/phase2-hydraulics.json',
    JSON.stringify({ ...result, ticks: 1500, initialWater: 840 }, null, 2) + '\n',
  );
  await testInfo.attach('hydraulics', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(result.water).toBe(840);
  expect(result.rightHigh).toBeGreaterThan(60);
  expect(Math.abs(result.leftHigh - result.rightHigh)).toBeLessThan(5);
});
