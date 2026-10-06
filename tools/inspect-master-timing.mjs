import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: process.env.GRANULE_BROWSER || undefined });
try {
  const page = await browser.newPage();
  await page.routeWebSocket('**/*', () => {});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => !!window.granule);
  const result = await page.evaluate(async () => {
    const { levels } = await import('/src/data/campaign.ts'),
      { Puzzle } = await import('/src/game/runtime.ts');
    const s = window.granule;
    s.paused = true;
    s.busy = true;
    const results = [];
    for (const l of levels.filter((l) => l.world === 11)) {
      const p = new Puzzle(s.engine, l),
        timing = Object.fromEntries(
          l.goals.map((g) => [g.id, { label: g.label, first: null, last: null }]),
        );
      let event = 0;
      for (let t = 0; t < 900; t++) {
        while (event < l.solution.events.length && l.solution.events[event].tick === t)
          p.place(l.solution.events[event++]);
        p.beforeStep();
        s.engine.step();
        if (s.engine.tick % 6 === 0) {
          await p.sense();
          for (const g of l.goals) {
            const value = p.readings[g.id][g.channel ?? 'count'];
            if (g.comparison === 'at-most' ? value <= g.target : value >= g.target) {
              timing[g.id].first ??= s.engine.tick;
              timing[g.id].last = s.engine.tick;
            }
          }
          p.solved = false;
          p.failed = false;
        }
      }
      results.push({ id: l.id, timing });
      p.dispose();
    }
    return results;
  });
  await writeFile('verification/master-timing.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
