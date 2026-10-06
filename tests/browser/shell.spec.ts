import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('menu, atlas, tutorial, results, settings and confirmed reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('#home-dialog')).toBeVisible();
  await page.screenshot({
    path: 'verification/phase4-menu.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.locator('#home-play').click();
  await expect(page.locator('[data-level="w1-02"]')).toBeDisabled();
  await page.screenshot({
    path: 'verification/phase4-map.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.locator('[data-level="w1-01"]').click();
  await page.locator('#dismiss-lesson').click();
  await expect(page.locator('#lesson')).toBeHidden();
  await page.evaluate(() => {
    const s = window.granule;
    s.place(s.puzzle!.level.solution.events[0]);
    s.paused = false;
  });
  await expect(page.locator('#result-title')).toHaveText('A small discovery.');
  await expect(page.locator('#result-stars')).toHaveText('★★★');
  await page.locator('#result-next').click();
  await expect(page.locator('#level-title')).toHaveText('Heavy rain');
  await expect(page.locator('#lesson')).toBeVisible();
  await page.locator('#settings-open').click();
  await page.locator('#setting-reduced-motion').check();
  await page.locator('#ui-scale').selectOption('18');
  await page.locator('#reset-progress').click();
  await page.locator('#reset-cancel').click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('granule-save')!).stars['w1-01']),
  ).toBe(3);
  await page.locator('#reset-progress').click();
  await page.locator('#reset-confirm').click();
  await expect(page.locator('[data-level="w1-02"]')).toBeDisabled();
  await page.reload();
  await page.locator('#home-settings').click();
  await expect(page.locator('#setting-reduced-motion')).toBeChecked();
  await expect(page.locator('#ui-scale')).toHaveValue('18');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'verification/phase4-phone-settings.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
test('rapid restart, resize, blur and sensor disposal remain usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const report = await page.evaluate(async () => {
    const path = '/src/data/campaign.ts';
    const { levels } = (await import(path)) as typeof import('../../src/data/campaign');
    const s = window.granule;
    for (let i = 0; i < 80; i++) {
      s.loadLevel(levels[(i * 7) % levels.length]);
      for (let n = 0; n < 6; n++) s.step();
      await new Promise((r) => setTimeout(r, 1));
    }
    s.loadLevel(levels[0]);
    await s.puzzle!.advance(6);
    return { restarts: 80, tick: s.engine.tick, glError: s.engine.gl.getError() };
  });
  expect(report.glError).toBe(0);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.locator('#sandbox-mode').click();
  await page.locator('#quality').selectOption('480');
  await expect(page.locator('#dimensions')).toContainText('480 × 270');
  await page.locator('#quality').selectOption('960');
  await expect(page.locator('#dimensions')).toContainText('960 × 540');
  expect(errors).toEqual([]);
  writeFileSync('verification/phase4-recovery.json', JSON.stringify(report, null, 2));
});
test('storage denial and time limit have clear recoverable outcomes', async ({ page }) => {
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  await page.locator('#play-level').click();
  await page.evaluate(async () => {
    await window.granule.puzzle!.advance(900);
    window.granule.onGameChange?.();
  });
  await expect(page.locator('#result-title')).toHaveText('Time for another approach.');
  await page.locator('#result-retry').click();
  await expect(page.locator('#result-panel')).toBeHidden();
  await page.locator('#sandbox-mode').click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota', 'QuotaExceededError');
    };
  });
  await page.locator('#save-world').click();
  await expect(page.locator('#notice')).toContainText('storage is full or unavailable');
});

test('all 110 levels unlock, score and persist through the actual game controller', async ({
  page,
}) => {
  test.setTimeout(900000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  await page.routeWebSocket('**/*', () => {});
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const path = '/src/data/campaign.ts',
      { levels } = (await import(path)) as typeof import('../../src/data/campaign');
    const completed = [];
    for (const level of levels) {
      const world = document.getElementById('campaign-world') as HTMLSelectElement;
      world.value = String(level.world);
      world.dispatchEvent(new Event('change'));
      const select = document.getElementById('campaign-level') as HTMLSelectElement;
      select.value = level.id;
      select.dispatchEvent(new Event('change'));
      const play = document.getElementById('play-level') as HTMLButtonElement;
      if (play.disabled) throw new Error(`Locked progression: ${level.id}`);
      play.click();
      const s = window.granule,
        g = s.puzzle!;
      s.busy = true;
      let event = 0;
      while (!g.solved && !g.failed) {
        while (
          event < level.solution.events.length &&
          level.solution.events[event].tick === s.engine.tick
        )
          if (!g.place(level.solution.events[event++]).accepted)
            throw new Error('Rejected reference');
        await g.advance(1);
      }
      s.busy = false;
      s.onGameChange?.();
      if (!g.solved) throw new Error(`Unsolved ${level.id}`);
      completed.push({ id: level.id, stars: g.stars });
    }
    return { completed, save: JSON.parse(localStorage.getItem('granule-save')!) };
  });
  expect(result.completed).toHaveLength(110);
  expect(Object.keys(result.save.stars)).toHaveLength(110);
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator('#stars-total')).toContainText(
    String(Object.values(result.save.stars).reduce((a: number, b) => a + Number(b), 0)),
  );
  writeFileSync(
    'verification/phase4-playthrough.json',
    JSON.stringify(
      { passed: true, completed: result.completed, consoleErrorsOrWarnings: errors },
      null,
      2,
    ),
  );
});
