import { test, expect } from '@playwright/test';
test('placing fire beside cold wood ignites it before the fire rises away', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const burning = await page.evaluate(async () => {
    const e = window.granule.engine;
    window.granule.paused = true;
    e.reset('empty');
    const data = await e.read();
    for (let y = 20; y < 60; y++)
      for (let x = 20; x < 60; x++) {
        const i = (y * e.width + x) * 4;
        const fire = (x + y) % 2 === 0;
        data[i] = fire ? 6 : 8;
        data[i + 1] = fire ? 650 : 20;
        data[i + 2] = fire ? 100 : 0;
      }
    e.upload(data);
    e.step();
    const result = await e.read();
    let burning = 0;
    for (let i = 0; i < result.length; i += 4) if (result[i] === 8 && result[i + 2] < 0) burning++;
    return burning;
  });
  expect(burning).toBeGreaterThan(20);
});
test('burning fuel ignites cold neighbors and water extinguishes wet fuel', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const e = window.granule.engine;
    window.granule.paused = true;
    e.reset('empty');
    const data = await e.read();
    for (let y = 20; y < 50; y++)
      for (let x = 20; x < 50; x++) {
        const i = (y * e.width + x) * 4;
        data[i] = (x + y) % 2 ? 8 : 4;
        data[i + 1] = (x + y) % 2 ? 600 : 20;
        data[i + 2] = (x + y) % 2 ? -100 : 0;
      }
    for (let y = 30; y < 36; y++)
      for (let x = 100; x < 150; x++) {
        const i = (y * e.width + x) * 4;
        data[i] = 8;
        data[i + 1] = x < 110 ? 600 : 20;
      }
    e.upload(data);
    e.step();
    const first = await e.read();
    let extinguished = 0;
    for (let y = 22; y < 48; y++)
      for (let x = 22; x < 48; x++) {
        const i = (y * e.width + x) * 4;
        if (first[i] === 8 && first[i + 2] === 0 && first[i + 1] <= 90) extinguished++;
      }
    for (let tick = 0; tick < 220; tick++) {
      e.step();
      if (tick % 20 === 0) await new Promise(requestAnimationFrame);
    }
    const final = await e.read();
    let spread = 0;
    for (let y = 30; y < 36; y++)
      for (let x = 111; x < 125; x++) {
        const i = (y * e.width + x) * 4;
        if (final[i] === 17 || (final[i] === 8 && final[i + 2] < 0)) spread++;
      }
    return { extinguished, spread };
  });
  expect(result.extinguished).toBeGreaterThan(100);
  expect(result.spread).toBeGreaterThan(0);
});
test('a conducted pulse ignites a remote explosive and generates pressure', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const e = window.granule.engine;
    window.granule.paused = true;
    e.reset('empty');
    const data = await e.read();
    const put = (x: number, y: number, id: number, life = 0) => {
      const i = (y * e.width + x) * 4;
      data[i] = id;
      data[i + 1] = 20;
      data[i + 2] = life;
    };
    for (let x = 20; x < 60; x++) put(x, 30, 19);
    put(19, 30, 31, 8);
    put(60, 30, 27);
    e.upload(data);
    let maxPressure = 0;
    for (let i = 0; i < 60; i++) {
      e.step();
      const field = await e.read('field');
      maxPressure = Math.max(maxPressure, field[(30 * e.width + 60) * 4]);
    }
    const final = await e.read();
    return { maxPressure, material: final[(30 * e.width + 60) * 4] };
  });
  expect(result.maxPressure).toBeGreaterThan(20);
  expect(result.material).not.toBe(27);
});
