import { readdir, readFile, writeFile } from 'node:fs/promises';
for (const file of await readdir('src/data/levels')) {
  if (!file.endsWith('.json')) continue;
  const path = `src/data/levels/${file}`,
    level = JSON.parse(await readFile(path, 'utf8'));
  for (const g of level.goals)
    if (g.latch === false && /guard|spill/i.test(g.label)) g.guard = true;
  if (level.world === 11) {
    for (const g of level.goals) g.latch = false;
    if (!level.lesson.startsWith('All targets'))
      level.lesson = 'All targets must register together. ' + level.lesson;
    level.hints[0] = level.lesson;
    level.hints[1] =
      'Persistent changes can be prepared first. Time brief electrical pulses and pressure waves so every live target is satisfied at the same sensor check.';
    if (level.id === 'w11-03') {
      const water = level.solution.events.find((e) => e.material === 4 && e.tool === 0);
      water.radius = 3;
      level.toolkit.budget = 207;
      level.toolkit.efficient = 194;
      level.hints[2] =
        'Place a small square of water, radius 3, at (190, 195). Load the sand control cup at (654, 270), radius 6, and place a radius-1 spark at the wire input (389, 182). Avoid submerging the entire plant.';
    }
  }
  await writeFile(path, JSON.stringify(level, null, 2) + '\n');
}
console.log('Marked persistent guards and authored simultaneous Master objectives.');
