import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
try {
  await mkdir('verification', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  await page.routeWebSocket('**/*', () => {});
  await page.goto('http://127.0.0.1:5173/?lab');
  await page.waitForFunction(() => !!window.granule);
  for (const id of ['w1-01', 'w5-09', 'w6-09', 'w4-05', 'w10-10', 'w11-03']) {
    await page.evaluate(async (id) => {
      const { levels } = await import('/src/data/campaign.ts');
      window.granule.loadLevel(levels.find((level) => level.id === id));
      window.granule.renderer.draw();
    }, id);
    await page.screenshot({ path: `verification/phase3-${id}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'verification/phase3-phone.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  await writeFile(
    'verification/phase3-ui.json',
    JSON.stringify(
      { passed: true, desktop: [1440, 1100], phone: [390, 844], consoleErrorsOrWarnings: errors },
      null,
      2,
    ),
  );
  console.log('Campaign desktop/phone screenshots saved; no overflow or console errors.');
} finally {
  await browser.close();
}
