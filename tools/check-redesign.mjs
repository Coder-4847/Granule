import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => !!window.granule);
  const interior = await page.evaluate(async () => {
    const s = window.granule;
    s.paused = true;
    const a = await s.engine.read();
    let n = 0;
    for (let y = 2; y < s.engine.height - 2; y++)
      for (let x = 2; x < s.engine.width - 2; x++) if (a[(y * s.engine.width + x) * 4] !== 0) n++;
    return n;
  });
  assert.equal(interior, 0);
  await page.screenshot({ path: 'verification/redesign-home.png', animations: 'disabled' });
  await page.locator('#home-sandbox').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'verification/redesign-workspace.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#menu').click();
  await page.screenshot({ path: 'verification/redesign-phone.png', animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  await writeFile(
    'verification/redesign.json',
    JSON.stringify({ emptyInteriorCellsOccupied: interior, phoneOverflow: false, errors }, null, 2),
  );
} finally {
  await browser.close();
}
