import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/granule/')) {
    response.writeHead(404).end();
    return;
  }
  const path = resolve(root, pathname.slice('/granule/'.length) || 'index.html');
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:4174/granule/');
  await page.locator('#home-return').click();
  await page.waitForFunction(() =>
    document.querySelector('#performance').textContent.includes('FPS'),
  );
  assert.equal(await page.locator('#fallback').isVisible(), false);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.locator('canvas').click({ position: { x: 300, y: 100 } });
  await page.locator('#diagnostics-toggle').click();
  await page.locator('#verify').click();
  await page.waitForFunction(() =>
    document.querySelector('#report').textContent.includes('identical'),
  );
  const replay = JSON.parse(await page.locator('#report').textContent());
  assert.equal(replay.identical, true);
  await page.locator('#play-level').click();
  await page.locator('#shape').selectOption('1');
  await page.evaluate(() => {
    const radius = document.querySelector('#radius');
    radius.value = '5';
    radius.dispatchEvent(new Event('input'));
  });
  const bounds = await page.locator('canvas').boundingBox();
  await page
    .locator('canvas')
    .click({ position: { x: (bounds.width * 450) / 960, y: bounds.height * (1 - 260 / 540) } });
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click();
  await page
    .waitForFunction(() =>
      document.querySelector('#budget-status').textContent.includes('Complete'),
    )
    .catch(async (error) => {
      console.error(
        await page.locator('#budget-status').textContent(),
        await page.locator('#notice').textContent(),
      );
      await page.screenshot({ path: 'verification/production-failure.png', fullPage: true });
      throw error;
    });
  const campaign = await page.locator('#budget-status').textContent();
  assert.ok(campaign.includes('★★★'));
  assert.equal(await page.evaluate(() => window.granule === undefined), true);
  await page.screenshot({ path: 'verification/production-campaign.png', fullPage: true });
  await page.locator('#sandbox-mode').click();
  await page.locator('canvas').click({ position: { x: 300, y: 100 } });
  await page.locator('#save-world').click();
  await page
    .waitForFunction(() => document.querySelector('#notice').textContent.includes('World saved'))
    .catch(async (error) => {
      console.error(await page.locator('#notice').textContent());
      throw error;
    });
  await page.locator('#clear').click();
  await page.locator('#load-world').click();
  await page.waitForFunction(() =>
    document.querySelector('#notice').textContent.includes('World restored'),
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.context().setOffline(true);
  await page.reload();
  await page.locator('#home-sandbox').click();
  await page.waitForFunction(() =>
    document.querySelector('#dimensions').textContent.includes('960'),
  );
  assert.equal(await page.locator('#fallback').isVisible(), false);
  await page.context().setOffline(false);
  assert.deepEqual(errors, []);
  await mkdir('verification', { recursive: true });
  await page.screenshot({ path: 'verification/production.png', fullPage: true });
  await writeFile(
    'verification/production-check.json',
    JSON.stringify(
      {
        subpath: '/granule/',
        passed: true,
        replay,
        campaign,
        worldSlotRoundTrip: true,
        devApiAbsent: true,
        offlineReload: true,
        consoleErrorsOrWarnings: errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Production /granule/ smoke check passed, including recorded-state replay identity.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
