import { validateLevel, type Level } from '../game/schema';

export const worlds = [
  'Foundations',
  'Water',
  'Fire',
  'Ice & Steam',
  'Machinery',
  'Chemistry',
  'Explosives',
  'Electricity',
  'Magma',
  'Synthesis',
  'Master',
];

const files = import.meta.glob('./levels/*.json', { eager: true, import: 'default' });
export const levels: Level[] = Object.values(files)
  .map(validateLevel)
  .sort((a, b) => a.world - b.world || a.order - b.order);

if (levels.length !== 110 || new Set(levels.map((l) => l.id)).size !== 110)
  throw new Error('Campaign manifest is incomplete.');
for (let world = 1; world <= 11; world++) {
  const orders = levels.filter((l) => l.world === world).map((l) => l.order);
  if (orders.join(',') !== '1,2,3,4,5,6,7,8,9,10')
    throw new Error(`World ${world} has an invalid level sequence.`);
}
