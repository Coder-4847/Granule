// Hand-authored connected mechanisms for World 10. Run deliberately: replaces w10 JSON.
import { readFile, writeFile } from 'node:fs/promises';
function scene(order, title, lesson) {
  const l = {
    version: 1,
    id: `w10-${String(order).padStart(2, '0')}`,
    world: 10,
    order,
    title,
    lesson,
    seed: 2000 + order,
    terrain: [],
    sensors: [],
    machines: [],
    goals: [],
    toolkit: { materials: [], tools: [0], budget: 1, efficient: 1, radius: 12 },
    work: [],
    timeLimit: 1800,
    bonus: { kind: 'time', limit: 1500 },
    hints: [],
    solution: { ticks: 1800, events: [] },
  };
  const rect = (x, y, w, h, m = 1, t) =>
    l.terrain.push({
      rect: [x, y, w, h],
      material: m,
      ...(t === undefined ? {} : { temperature: t }),
    });
  const cup = (x, y, w, h, t) => {
    rect(x - 4, y - 4, w + 8, 4, 1, t);
    rect(x - 4, y, 4, h, 1, t);
    rect(x + w, y, 4, h, 1, t);
  };
  const goal = (
    id,
    label,
    box,
    material,
    target,
    channel = 'count',
    comparison = 'at-least',
    latch = true,
  ) => {
    l.goals.push({ id, label, rect: box, material, target, channel, comparison, latch });
    return id;
  };
  const sensor = (id, box, material) => {
    l.sensors.push({ id, rect: box, material });
    return id;
  };
  const machine = (id, kind, box, sensor, threshold, extra = {}) =>
    l.machines.push({ id, kind, rect: box, sensor, threshold, latch: true, ...extra });
  const gate = (id, box, sensor, threshold, extra = {}) =>
    machine(id, 'gate', box, sensor, threshold, extra);
  let cost = 0;
  const draw = (x, y, m, r = 6, tool = 0, tick = 0, end = [x, y], repeats = 1) => {
    if (!l.toolkit.materials.includes(m || 3)) l.toolkit.materials.push(m || 3);
    if (!l.toolkit.tools.includes(tool)) l.toolkit.tools.push(tool);
    for (let i = 0; i < repeats; i++)
      l.solution.events.push({
        tick,
        from: [x, y],
        to: end,
        radius: r,
        material: m,
        shape: 1,
        tool,
        overwrite: false,
      });
    cost += (2 * r + Math.abs(end[0] - x)) * (2 * r + Math.abs(end[1] - y)) * repeats;
  };
  const wire = (x, y, length, gapAt, gapWidth = 16) => {
    rect(x, y, length, 4, 19);
    if (gapAt !== undefined) {
      rect(gapAt, y, gapWidth, 4, 0);
      l.work.push([gapAt - 8, y - 8, gapWidth + 16, 20]);
      draw(gapAt, y + 2, 19, 2, 0, 0, [gapAt + gapWidth, y + 2]);
    }
  };
  const guard = (id, x, y, w, h, m) =>
    goal(id, 'Keep the spill guard clear', [x, y, w, h], m, 8, 'count', 'at-most', false);
  const finish = () => {
    l.solution.events.sort((a, b) => a.tick - b.tick);
    l.toolkit.budget = Math.ceil(cost * 1.22);
    l.toolkit.efficient = Math.ceil(cost * 1.05);
    l.hints = [
      lesson,
      'Trace the dotted sensor links. The final receiver has no work area: operate the upstream mechanism to reach it.',
      l.solution.events
        .map(
          (e) =>
            `${e.tool === 1 ? 'Heat' : e.tool === 2 ? 'Freeze' : `Material ${e.material}`} at (${e.from.join(', ')}), square radius ${e.radius}${e.to[0] !== e.from[0] ? ` to (${e.to.join(', ')})` : ''}.`,
        )
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(' '),
    ];
    return l;
  };
  return { l, rect, cup, goal, sensor, machine, gate, draw, wire, guard, finish };
}
const output = [];
{
  const { l, rect, cup, goal, sensor, machine, gate, draw, wire, finish } = scene(
    1,
    'River foundry',
    'Repair the dry conductor, then power the mill. Its remote charge opens the cooling-water sluice above the lava.',
  );
  cup(148, 260, 44, 110);
  l.work.push([100, 320, 180, 90]);
  draw(170, 344, 4, 6);
  const wet = goal('mill-water', 'Supply 120 water cells to the mill', [148, 260, 44, 80], 4, 120);
  machine('mill', 'wheel', [200, 252, 14, 20], wet, 120, { output: [219, 262] });
  wire(220, 260, 250, 332);
  rect(470, 256, 8, 12, 27);
  const pressure = goal(
    'detonation',
    'Trigger the remote charge',
    [466, 252, 24, 24],
    -1,
    2,
    'pressure',
  );
  cup(610, 150, 52, 240);
  rect(610, 280, 52, 30, 4);
  gate('coolant-sluice', [610, 274, 52, 6], pressure, 2, { channel: 'pressure' });
  rect(610, 150, 52, 5, 23, 1250);
  goal('crust', 'Quench at least 30 cells of lava', [610, 150, 52, 80], 24, 30);
  goal('coolant', 'Deliver 200 remaining water cells', [610, 150, 52, 100], 4, 200);
  sensor('flow-witness', [610, 160, 52, 80], 4);
  output.push(finish());
}
{
  const { l, rect, cup, goal, machine, gate, draw, finish } = scene(
    2,
    'Garden engine',
    'Water lifts one latch; a sand counterweight opens the other. Both must release the shared reservoir into the planted earth below.',
  );
  cup(130, 250, 40, 110);
  cup(300, 250, 40, 110);
  l.work.push([90, 320, 120, 90], [260, 320, 120, 90]);
  draw(150, 340, 4, 6);
  draw(320, 340, 3, 6);
  const a = goal('float-water', 'Raise the wet float', [130, 250, 40, 70], 4, 120),
    b = goal('sand-weight', 'Load the counterweight', [300, 250, 40, 70], 3, 120);
  machine('float', 'float', [180, 260, 18, 8], a, 120, { travel: [0, 24] });
  machine('lever', 'lever', [350, 260, 24, 6], b, 120, { travel: [12, 18] });
  cup(580, 150, 64, 260);
  rect(580, 360, 64, 24, 4);
  gate('upper-latch', [580, 352, 64, 8], a, 120);
  gate('lower-latch', [580, 318, 64, 8], b, 120);
  rect(580, 150, 64, 4, 13);
  rect(608, 154, 4, 24, 18);
  goal('mud', 'Irrigate the soil: 60 mud cells', [580, 150, 64, 64], 14, 60);
  goal('plant', 'Grow the planted stem beyond 96 cells', [580, 150, 64, 100], 18, 104);
  output.push(finish());
}
{
  const { l, rect, cup, goal, gate, draw, finish } = scene(
    3,
    'Salt and smoke',
    'Burn the suspended wooden valve. The falling salt makes brine, which releases a second, protected grain reservoir.',
  );
  cup(280, 170, 48, 220);
  rect(280, 170, 48, 18, 4);
  rect(280, 280, 48, 4, 8);
  rect(280, 284, 48, 16, 15);
  l.work.push([270, 260, 68, 48]);
  draw(304, 282, 8, 12, 1, 0, [304, 282], 5);
  const brine = goal(
    'brine',
    'Mix 100 brine cells below the burned valve',
    [280, 170, 48, 100],
    32,
    100,
  );
  goal('valve', 'Remove the wooden salt valve', [280, 280, 48, 4], 8, 0, 'count', 'at-most');
  cup(610, 160, 48, 230);
  rect(610, 320, 48, 20, 3);
  gate('grain-sluice', [610, 314, 48, 6], brine, 100);
  goal('delivered', 'Deliver 600 protected sand cells', [610, 160, 48, 120], 3, 600);
  output.push(finish());
}
{
  const { l, rect, cup, goal, machine, gate, draw, wire, finish } = scene(
    4,
    'Cold demolition',
    'A frozen sample closes the relay. Rebuild the conductor so its pulse can open the protected oil reservoir.',
  );
  rect(120, 250, 60, 60, 1, 20);
  rect(146, 276, 8, 8, 4);
  l.work.push([110, 240, 80, 80]);
  draw(150, 280, 4, 10, 2);
  const cold = goal('ice', 'Close the ice switch: 32 ice cells', [146, 276, 8, 8], 10, 32);
  machine('cold-relay', 'relay', [196, 270, 12, 12], cold, 32, { output: [219, 282] });
  wire(220, 280, 270, 338);
  rect(490, 276, 8, 12, 27);
  const pressure = goal('pressure', 'Fire the remote lock', [486, 272, 24, 24], -1, 2, 'pressure');
  cup(640, 150, 48, 240);
  rect(640, 150, 48, 12, 4);
  rect(640, 300, 48, 20, 5);
  gate('oil-lock', [640, 294, 48, 6], pressure, 2, { channel: 'pressure' });
  goal('oil', 'Float 600 oil cells on the receiving water', [640, 162, 48, 100], 5, 600);
  output.push(finish());
}
{
  const { l, rect, cup, goal, sensor, machine, gate, draw, wire, finish } = scene(
    5,
    'Obsidian mill',
    'Quench the volcanic control cup. Enough surviving water and enough obsidian together release the mill reservoir and power the far contact.',
  );
  cup(150, 220, 44, 120, 1250);
  rect(150, 220, 44, 2, 23, 1250);
  l.work.push([90, 290, 180, 100]);
  draw(172, 320, 4, 12);
  const rock = goal('rock', 'Form 40 obsidian cells', [150, 220, 44, 50], 24, 40),
    water = goal('water', 'Retain 300 coolant cells', [150, 220, 44, 70], 4, 300);
  cup(420, 180, 48, 220);
  rect(420, 350, 48, 20, 4);
  gate('rock-lock', [420, 344, 48, 6], rock, 40);
  gate('water-lock', [420, 314, 48, 6], water, 300);
  const wet = sensor('mill-flow', [420, 180, 48, 100], 4);
  machine('turbine', 'turbine', [484, 180, 16, 16], wet, 300, { output: [509, 190] });
  wire(510, 188, 200);
  goal('output', 'Carry turbine current to the far contact', [680, 188, 28, 4], 19, 0.3, 'charge');
  output.push(finish());
}
{
  const { l, rect, cup, goal, machine, gate, draw, wire, guard, finish } = scene(
    6,
    'Etched glass',
    'Etch the metal control coupon. The released sand presses a plate, which sends a pulse to demolish the remote glass partition.',
  );
  cup(180, 220, 40, 130);
  rect(180, 220, 40, 1, 19);
  l.work.push([110, 250, 180, 100]);
  draw(200, 280, 22, 10);
  rect(100, 160, 200, 4);
  rect(100, 160, 4, 230);
  rect(296, 160, 4, 230);
  guard('left-spill', 104, 164, 72, 220, 22);
  guard('right-spill', 224, 164, 72, 220, 22);
  const etched = goal(
    'etched',
    'Dissolve the 40-cell metal coupon',
    [180, 220, 40, 1],
    19,
    4,
    'count',
    'at-most',
  );
  cup(400, 190, 40, 210);
  rect(400, 330, 40, 18, 3);
  gate('grain-valve', [400, 324, 40, 6], etched, 4, { comparison: 'at-most' });
  const plate = goal('plate', 'Put 400 sand cells on the plate', [400, 190, 40, 100], 3, 400);
  machine('plate-relay', 'relay', [450, 190, 12, 10], plate, 400, { output: [469, 202] });
  wire(470, 200, 210);
  rect(680, 196, 8, 12, 27);
  rect(697, 190, 6, 32, 20);
  goal(
    'glass',
    'Demolish the remote glass partition',
    [697, 190, 6, 32],
    20,
    8,
    'count',
    'at-most',
  );
  output.push(finish());
}
{
  const { l, rect, cup, goal, gate, draw, finish } = scene(
    7,
    'Weather station',
    'Keep the weathering plate wet until rust trips the valve. Warm reservoir water then thaws the isolated ice chamber.',
  );
  cup(210, 220, 44, 120);
  rect(210, 220, 44, 2, 19);
  l.work.push([130, 280, 200, 100]);
  draw(232, 308, 4, 10);
  const rust = goal('rust', 'Weather at least 4 metal cells', [210, 220, 44, 2], 29, 4);
  goal('wet-plate', 'Keep 300 water cells over the weathering plate', [210, 222, 44, 110], 4, 300);
  cup(600, 150, 48, 250, 60);
  rect(600, 150, 48, 8, 10, -20);
  rect(600, 320, 48, 30, 4, 60);
  gate('weather-valve', [600, 314, 48, 6], rust, 4);
  goal('thaw', 'Thaw the isolated ice block', [600, 150, 48, 10], 10, 10, 'count', 'at-most');
  goal('delivered', 'Collect 900 meltwater and reservoir cells', [600, 150, 48, 130], 4, 900);
  output.push(finish());
}
{
  const { l, rect, cup, goal, gate, draw, wire, finish } = scene(
    8,
    'Deep quarry',
    'Bridge the conductor, then spark its protected input. The blast-operated sluice releases gravel into a sand-filled sorting chamber.',
  );
  wire(180, 300, 300, 314);
  l.work.push([130, 270, 40, 70]);
  draw(179, 302, 31, 1); // Extend the ignition work window to touch the contact.
  goal(
    'repaired-conductor',
    'Restore all 64 cells of the missing conductor',
    [314, 300, 16, 4],
    19,
    64,
  );
  l.work[l.work.length - 1] = [140, 270, 50, 70];
  rect(480, 296, 8, 12, 27);
  rect(498, 288, 8, 36, 2);
  const pressure = goal(
    'blast',
    'Activate the blast-operated sluice',
    [480, 290, 24, 28],
    -1,
    2,
    'pressure',
  );
  cup(650, 140, 52, 240);
  rect(650, 140, 52, 6, 3);
  rect(650, 320, 52, 20, 12);
  gate('quarry-sluice', [650, 314, 52, 6], pressure, 2, { channel: 'pressure' });
  goal('gravel', 'Catch 700 gravel cells', [650, 140, 52, 130], 12, 700);
  goal('sand', 'Preserve the 312-cell sand bed', [650, 140, 52, 130], 3, 300);
  output.push(finish());
}
{
  const { l, rect, cup, goal, machine, gate, draw, wire, finish } = scene(
    9,
    'Pressure garden',
    'New plant growth trips a relay. Reconnect its wire so the remote blast can release the screened grain supply.',
  );
  cup(150, 210, 44, 130);
  rect(170, 210, 4, 8, 18);
  l.work.push([100, 280, 160, 100]);
  draw(172, 310, 4, 10);
  const plant = goal(
    'growth',
    'Grow beyond the 32-cell starting plant',
    [150, 210, 44, 100],
    18,
    40,
  );
  machine('growth-relay', 'relay', [216, 210, 12, 12], plant, 40, { output: [239, 222] });
  wire(240, 220, 290, 370);
  rect(530, 216, 8, 12, 27);
  const pressure = goal(
    'charge',
    'Fire the remote grain lock',
    [526, 212, 24, 24],
    -1,
    2,
    'pressure',
  );
  cup(700, 130, 44, 260);
  rect(700, 320, 44, 20, 3);
  gate('grain-lock', [700, 314, 44, 6], pressure, 2, { channel: 'pressure' });
  rect(700, 230, 15, 4);
  rect(729, 230, 15, 4);
  goal('grain', 'Deliver 500 grains through the screen', [700, 130, 44, 90], 3, 500);
  output.push(finish());
}
{
  const { l, rect, cup, goal, sensor, machine, gate, draw, wire, finish } = scene(
    10,
    'Granule',
    'Three independent interlocks protect one reservoir: ice, etched metal, and a sand weight. Open all three to power the final generator and remote charge.',
  );
  rect(90, 320, 52, 52, 1, 20);
  rect(112, 342, 8, 8, 4);
  l.work.push([80, 310, 72, 72]);
  draw(116, 346, 4, 10, 2);
  const ice = goal('ice', 'Close the ice interlock', [112, 342, 8, 8], 10, 32);
  cup(250, 300, 40, 100);
  rect(250, 300, 40, 1, 19);
  l.work.push([220, 340, 100, 90]);
  draw(270, 370, 22, 10);
  const acid = goal(
    'acid',
    'Etch the metal interlock',
    [250, 300, 40, 1],
    19,
    4,
    'count',
    'at-most',
  );
  cup(390, 300, 40, 100);
  l.work.push([360, 340, 100, 90]);
  draw(410, 370, 3, 6);
  const weight = goal('weight', 'Load the sand interlock', [390, 300, 40, 70], 3, 120);
  cup(590, 140, 56, 300);
  rect(590, 380, 56, 30, 4);
  gate('ice-gate', [590, 372, 56, 8], ice, 32);
  gate('acid-gate', [590, 338, 56, 8], acid, 4, { comparison: 'at-most' });
  gate('weight-gate', [590, 304, 56, 8], weight, 120);
  const wet = sensor('generator-water', [590, 140, 56, 120], 4);
  machine('generator', 'wheel', [662, 144, 16, 16], wet, 700, { output: [687, 154] });
  wire(688, 152, 150);
  rect(838, 148, 8, 12, 27);
  goal(
    'final',
    'Fire the final charge through the powered wire',
    [832, 142, 26, 28],
    -1,
    2,
    'pressure',
  );
  output.push(finish());
}
for (const l of output) {
  // Preserve catalog identity, while replacing the earlier independent exercise layout.
  await readFile(`src/data/levels/${l.id}.json`, 'utf8');
  await writeFile(`src/data/levels/${l.id}.json`, JSON.stringify(l, null, 2) + '\n');
}
console.log(`Authored ${output.length} connected Synthesis mechanisms.`);
