import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url = 'https://coder-4847.github.io/Granule/';
const browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  await page.locator('#home-play').click();
  await page.locator('[data-level="w1-01"]').click();
  await page.locator('#shape').selectOption('1');
  const bounds = await page.locator('canvas').boundingBox();
  await page
    .locator('canvas')
    .click({ position: { x: (bounds.width * 450) / 960, y: bounds.height * (1 - 260 / 540) } });
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('#budget-status').textContent.includes('Complete'),
  );
  const result = await page.locator('#budget-status').textContent();
  assert.ok(result.includes('★★★'));
  assert.equal(await page.evaluate(() => window.granule === undefined), true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.context().setOffline(true);
  await page.reload();
  await page.locator('#home-sandbox').click();
  assert.equal(await page.locator('#fallback').isVisible(), false);
  assert.deepEqual(errors, []);
  await writeFile(
    'verification/pages-live.json',
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        passed: true,
        firstLevel: result,
        offlineReload: true,
        consoleErrorsOrWarnings: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'Live Pages check passed: HTTP 200, three-star puzzle solve, offline reload, no console errors or warnings.',
  );
} finally {
  await browser.close();
}
