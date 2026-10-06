import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test('campaign reference solutions obey budgets and reach their GPU objectives', async ({
  page,
}) => {
  test.setTimeout(900000);
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
      const game = new Puzzle(session.engine, level);
      let event = 0,
        rejected = false;
      while (!game.solved && !game.failed) {
        while (
          event < level.solution.events.length &&
          level.solution.events[event].tick === session.engine.tick
        ) {
          if (!game.place(level.solution.events[event++]).accepted) rejected = true;
        }
        await game.advance(1);
      }
      results.push({
        id: level.id,
        title: level.title,
        solved: game.solved,
        rejected,
        used: game.budget.used,
        budget: level.toolkit.budget,
        ticks: session.engine.tick,
        goals: level.goals.map((g) => ({
          label: g.label,
          target: g.target,
          value: game.readings[g.id]?.[g.channel ?? 'count'],
          reached: game.reached.has(g.id),
        })),
      });
      game.dispose();
    }
    session.busy = false;
    return results;
  });
  mkdirSync('verification', { recursive: true });
  writeFileSync('verification/phase3-solutions.json', JSON.stringify(result, null, 2));
  expect(result.filter((r) => !r.solved || r.rejected)).toEqual([]);
  expect(result).toHaveLength(110);
});
