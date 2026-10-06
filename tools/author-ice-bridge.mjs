import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/data/levels/w4-05.json';
const l = JSON.parse(await readFile(path, 'utf8'));
Object.assign(l, {
  title: 'Load-bearing ice',
  lesson:
    'Freeze the surface before the falling sand arrives. An ice bridge keeps the load in the upper target; unfrozen water lets the grains sink below it.',
  terrain: [
    { rect: [396, 136, 72, 4], material: 1 },
    { rect: [396, 140, 4, 110], material: 1 },
    { rect: [464, 140, 4, 110], material: 1 },
    { rect: [400, 140, 64, 70], material: 4 },
    { rect: [427, 300, 10, 10], material: 3 },
  ],
  sensors: [],
  machines: [],
  goals: [
    {
      id: 'bridge',
      label: 'Form a bridge of at least 100 ice cells',
      rect: [410, 196, 44, 18],
      material: 10,
      target: 100,
      latch: false,
    },
    {
      id: 'supported-load',
      label: 'Support 80 sand cells above the waterline',
      rect: [420, 210, 28, 32],
      material: 3,
      target: 80,
      latch: false,
    },
  ],
  work: [[410, 194, 44, 34]],
  toolkit: { materials: [4], tools: [0, 2], budget: 490, efficient: 420, radius: 12 },
  hints: [
    'Powders sink through water but cannot pass through solid ice.',
    'Pause while preparing a cold patch directly under the suspended sand. The target checks that both the bridge and its load remain in place.',
    'Use the freeze tool at (432, 208), square radius 10, once. Resume and let the sand settle on the frozen surface.',
  ],
  solution: {
    ticks: 900,
    events: [
      {
        tick: 0,
        from: [432, 208],
        to: [432, 208],
        radius: 10,
        material: 4,
        shape: 1,
        tool: 2,
        overwrite: false,
      },
    ],
  },
});
await writeFile(path, JSON.stringify(l, null, 2) + '\n');
console.log('Authored the load-bearing ice bridge.');
