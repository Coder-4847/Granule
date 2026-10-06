// Materialize the authoring definitions into individually editable level data files.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
try {
  const page = await browser.newPage();
  await page.routeWebSocket('**/*', () => {});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => !!window.granule);
  const levels = await page.evaluate(async () => {
    window.granule.paused = true;
    return (await import('/src/data/campaign.ts')).levels;
  });
  await mkdir('src/data/levels', { recursive: true });
  for (const level of levels)
    await writeFile(`src/data/levels/${level.id}.json`, JSON.stringify(level, null, 2) + '\n');
  console.log(
    `Exported ${levels.length} validated level definitions and reference input sequences.`,
  );
} finally {
  await browser.close();
}
