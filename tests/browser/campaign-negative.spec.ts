import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test('campaign rejects inactivity and budget-limited uniform single-material spam', async ({
  page,
}) => {
  test.setTimeout(1200000);
  await page.routeWebSocket('**/*', () => {});
  await page.goto('/?lab');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const campaignPath = '/src/data/campaign.ts',
      runtimePath = '/src/game/runtime.ts';
    const { levels } = (await import(campaignPath)) as typeof import('../../src/data/campaign');
    const { Puzzle } = (await import(runtimePath)) as typeof import('../../src/game/runtime');
    const session = window.granule;
    session.paused = true;
    session.busy = true;
    const results = [];
    for (const level of levels) {
      for (const material of [-1, ...level.toolkit.materials]) {
        const game = new Puzzle(session.engine, level);
        let accepted = 0;
        if (material !== -1) {
          // A deterministic uniform distribution across every legal work area, using the
          // smallest square brush. It stays inside the real budget, without bypassing rules.
          const points: [number, number][] = [];
          for (const [x, y, w, h] of level.work)
            for (let py = y + 1; py < y + h; py += 2)
              for (let px = x + 1; px < x + w; px += 2) points.push([px, py]);
          const count = Math.min(points.length, Math.floor(level.toolkit.budget / 4));
          for (let i = 0; i < count; i++) {
            const p = points[Math.floor(((i + 0.5) * points.length) / count)];
            if (
              game.place({
                tick: 0,
                from: p,
                to: p,
                radius: 1,
                material,
                shape: 1,
                tool: 0,
                overwrite: false,
              }).accepted
            )
              accepted++;
          }
        }
        while (!game.solved && !game.failed) await game.advance(6);
        results.push({
          id: level.id,
          control: material === -1 ? 'no-input' : `uniform-${material}`,
          solved: game.solved,
          used: game.budget.used,
          accepted,
          ticks: session.engine.tick,
        });
        game.dispose();
      }
    }
    session.busy = false;
    return results;
  });
  mkdirSync('verification', { recursive: true });
  writeFileSync('verification/phase3-negative-controls.json', JSON.stringify(result, null, 2));
  expect(result.filter((r) => r.solved)).toEqual([]);
  expect(result.filter((r) => r.control === 'no-input')).toHaveLength(110);
});
