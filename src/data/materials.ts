export type Phase = 'empty' | 'solid' | 'powder' | 'liquid' | 'gas';
export interface Material {
  id: number;
  name: string;
  phase: Phase;
  density: number;
  viscosity: number;
  color: readonly [number, number, number];
  conductivity: number;
  heatCapacity: number;
  temperature: number;
  emissive: number;
  description: string;
  ignition?: number;
  burnTo?: number;
  lifetime?: number;
  decayTo?: number;
  hot?: { at: number; to: number };
  cold?: { at: number; to: number };
  burnTicks?: number;
  residue?: number;
  explosive?: number;
  hardness?: number;
  debris?: number;
  electrical?: number;
  chargeSource?: boolean;
  growth?: number;
  coolant?: boolean;
  pattern?: 1 | 2 | 3;
  reactions?: readonly ContactReaction[];
}
export interface ContactReaction {
  with: number;
  to: number;
  chance: number;
  event: number;
  temperature?: number;
}
const base: Material[] = [
  {
    id: 0,
    name: 'Air',
    phase: 'empty',
    density: 0,
    viscosity: 0,
    color: [0.055, 0.069, 0.075],
    conductivity: 0.015,
    heatCapacity: 1,
    temperature: 20,
    emissive: 0,
    description: 'Empty space. Erases matter.',
  },
  {
    id: 1,
    name: 'Wall',
    phase: 'solid',
    density: 100,
    viscosity: 1,
    color: [0.26, 0.3, 0.31],
    conductivity: 0.08,
    heatCapacity: 4,
    temperature: 20,
    emissive: 0,
    description: 'An immovable, indestructible boundary.',
  },
  {
    id: 2,
    name: 'Stone',
    phase: 'solid',
    density: 8,
    viscosity: 1,
    color: [0.43, 0.44, 0.42],
    conductivity: 0.1,
    heatCapacity: 3,
    temperature: 20,
    emissive: 0,
    description: 'Solid terrain. Holds back flowing matter.',
  },
  {
    id: 3,
    name: 'Sand',
    phase: 'powder',
    density: 2.6,
    viscosity: 0,
    color: [0.84, 0.68, 0.39],
    conductivity: 0.04,
    heatCapacity: 2,
    temperature: 20,
    emissive: 0,
    description: 'Falls, piles, and sinks through water.',
  },
  {
    id: 4,
    name: 'Water',
    phase: 'liquid',
    density: 1,
    viscosity: 0.02,
    color: [0.22, 0.49, 0.68],
    conductivity: 0.23,
    heatCapacity: 4,
    temperature: 20,
    emissive: 0,
    hot: { at: 100, to: 7 },
    cold: { at: -2, to: 10 },
    description: 'Flows through channels. Boils into steam.',
  },
  {
    id: 5,
    name: 'Oil',
    phase: 'liquid',
    density: 0.8,
    viscosity: 0.2,
    color: [0.5, 0.43, 0.24],
    conductivity: 0.08,
    heatCapacity: 2,
    temperature: 20,
    emissive: 0,
    ignition: 220,
    burnTo: 6,
    description: 'Floats on water and catches fire.',
  },
  {
    id: 6,
    name: 'Fire',
    phase: 'gas',
    density: -0.5,
    viscosity: 0,
    color: [1, 0.36, 0.07],
    conductivity: 0.42,
    heatCapacity: 1,
    temperature: 650,
    emissive: 1,
    lifetime: 100,
    decayTo: 9,
    description: 'Rises, heats nearby matter, and ignites fuel.',
  },
  {
    id: 7,
    name: 'Steam',
    phase: 'gas',
    density: -0.25,
    viscosity: 0.08,
    color: [0.62, 0.72, 0.74],
    conductivity: 0.12,
    heatCapacity: 2,
    temperature: 115,
    emissive: 0,
    cold: { at: 88, to: 4 },
    description: 'Water vapor. Rises and condenses as it cools.',
  },
  {
    id: 8,
    name: 'Wood',
    phase: 'solid',
    density: 0.7,
    viscosity: 1,
    color: [0.46, 0.3, 0.19],
    conductivity: 0.08,
    heatCapacity: 2,
    temperature: 20,
    emissive: 0,
    ignition: 280,
    burnTo: 6,
    description: 'A combustible structural material.',
  },
  {
    id: 9,
    name: 'Smoke',
    phase: 'gas',
    density: -0.15,
    viscosity: 0.15,
    color: [0.3, 0.32, 0.32],
    conductivity: 0.04,
    heatCapacity: 1,
    temperature: 90,
    emissive: 0,
    lifetime: 250,
    decayTo: 0,
    description: 'Drifts upward and slowly disperses.',
  },
  {
    id: 10,
    name: 'Ice',
    phase: 'solid',
    density: 0.92,
    viscosity: 1,
    color: [0.57, 0.79, 0.83],
    conductivity: 0.16,
    heatCapacity: 3,
    temperature: -20,
    emissive: 0,
    hot: { at: 2, to: 4 },
    description: 'Frozen water. Melts when warmed.',
  },
  {
    id: 11,
    name: 'Gas',
    phase: 'gas',
    density: -0.1,
    viscosity: 0.03,
    color: [0.41, 0.49, 0.36],
    conductivity: 0.1,
    heatCapacity: 1,
    temperature: 20,
    emissive: 0,
    ignition: 170,
    burnTo: 6,
    description: 'A rising, highly flammable gas.',
  },
];
function make(
  id: number,
  name: string,
  phase: Phase,
  density: number,
  color: Material['color'],
  description: string,
  extra: Partial<Material> = {},
): Material {
  return {
    id,
    name,
    phase,
    density,
    color,
    description,
    viscosity: phase === 'solid' ? 1 : 0.08,
    conductivity: 0.12,
    heatCapacity: 2,
    temperature: 20,
    emissive: 0,
    ...extra,
  };
}
const additions: Material[] = [
  make(12, 'Gravel', 'powder', 3, [0.48, 0.46, 0.41], 'Heavy fragments of broken stone.', {
    hardness: 22,
  }),
  make(13, 'Dirt', 'powder', 1.8, [0.39, 0.28, 0.18], 'Absorbs water to form mud.', {
    reactions: [{ with: 4, to: 14, chance: 0.15, event: 6 }],
  }),
  make(
    14,
    'Mud',
    'liquid',
    1.7,
    [0.32, 0.25, 0.18],
    'Thick, slow-flowing wet earth. Dries when heated.',
    { viscosity: 0.88, hot: { at: 100, to: 13 } },
  ),
  make(
    15,
    'Salt',
    'powder',
    2.2,
    [0.85, 0.84, 0.77],
    'Dissolves in water and lowers the freezing point.',
    {
      reactions: [
        { with: 4, to: 32, chance: 0.15, event: 3 },
        { with: 10, to: 32, chance: 0.1, event: 5 },
      ],
    },
  ),
  make(16, 'Coal', 'powder', 2, [0.18, 0.19, 0.19], 'Slow-burning fuel with a long, hot glow.', {
    ignition: 350,
    burnTicks: 480,
    residue: 17,
  }),
  make(17, 'Ash', 'powder', 0.3, [0.49, 0.48, 0.45], 'Light residue left by burning fuel.'),
  make(18, 'Plant', 'solid', 0.4, [0.33, 0.55, 0.25], 'Uses nearby water to extend new vines.', {
    ignition: 180,
    burnTicks: 100,
    residue: 17,
    growth: 0.018,
  }),
  make(
    19,
    'Metal',
    'solid',
    7.8,
    [0.49, 0.57, 0.59],
    'Conducts electrical pulses and heat. Rusts in water.',
    {
      conductivity: 0.85,
      heatCapacity: 1,
      hot: { at: 1400, to: 33 },
      electrical: 1,
      hardness: 75,
      debris: 12,
      reactions: [{ with: 4, to: 29, chance: 0.001, event: 3 }],
    },
  ),
  make(
    20,
    'Glass',
    'solid',
    2.5,
    [0.52, 0.69, 0.67],
    'A transparent barrier. Softens at high temperatures.',
    { hot: { at: 1000, to: 34 }, hardness: 12, debris: 3 },
  ),
  make(
    21,
    'Snow',
    'powder',
    0.4,
    [0.86, 0.92, 0.92],
    'Light frozen grains that melt when warmed.',
    { temperature: -12, hot: { at: 1, to: 4 } },
  ),
  make(
    22,
    'Acid',
    'liquid',
    1.15,
    [0.56, 0.72, 0.22],
    'Corrodes stone, metal, and wood; consumed in the reaction.',
    {
      reactions: [
        { with: 2, to: 4, chance: 0.03, event: 3 },
        { with: 19, to: 4, chance: 0.12, event: 3 },
        { with: 8, to: 4, chance: 0.06, event: 3 },
      ],
    },
  ),
  make(
    23,
    'Lava',
    'liquid',
    3,
    [0.94, 0.24, 0.055],
    'Molten rock. Quenches into obsidian on contact with water.',
    {
      temperature: 1250,
      emissive: 0.8,
      viscosity: 0.65,
      conductivity: 0.6,
      cold: { at: 650, to: 24 },
      reactions: [
        { with: 4, to: 24, chance: 1, event: 7, temperature: 350 },
        { with: 32, to: 24, chance: 1, event: 7, temperature: 350 },
      ],
    },
  ),
  make(24, 'Obsidian', 'solid', 3, [0.19, 0.17, 0.23], 'Volcanic glass formed by cooling lava.', {
    hardness: 45,
    debris: 20,
    hot: { at: 1200, to: 23 },
  }),
  make(
    25,
    'Embers',
    'powder',
    0.25,
    [0.9, 0.29, 0.08],
    'Glowing cinders that ignite fuel and cool into ash.',
    { temperature: 720, emissive: 0.6, lifetime: 180, decayTo: 17 },
  ),
  make(
    26,
    'Gunpowder',
    'powder',
    1.7,
    [0.31, 0.3, 0.27],
    'Explodes when heated, sparked, or hit by a shockwave.',
    { ignition: 190, explosive: 38, hardness: 4 },
  ),
  make(
    27,
    'TNT',
    'solid',
    1.6,
    [0.67, 0.25, 0.18],
    'A powerful explosive with pressure-triggered chain reactions.',
    { ignition: 240, explosive: 100, hardness: 6 },
  ),
  make(28, 'Fuse', 'solid', 0.7, [0.63, 0.52, 0.32], 'Carries a slow burn to explosives.', {
    ignition: 130,
    burnTicks: 100,
    residue: 17,
    conductivity: 0.7,
  }),
  make(
    29,
    'Rust',
    'powder',
    3,
    [0.6, 0.29, 0.13],
    'Brittle, non-conductive corrosion from wet metal.',
  ),
  make(
    30,
    'Foam',
    'liquid',
    0.12,
    [0.71, 0.8, 0.69],
    'A light insulating foam. Breaks down over time.',
    { viscosity: 0.6, lifetime: 400, decayTo: 4, conductivity: 0.015, coolant: true },
  ),
  make(
    31,
    'Spark',
    'gas',
    -0.6,
    [1, 0.88, 0.45],
    'A short electrical pulse that ignites gas and powder.',
    { temperature: 850, emissive: 1, lifetime: 8, decayTo: 0, chargeSource: true },
  ),
  make(
    32,
    'Brine',
    'liquid',
    1.1,
    [0.36, 0.57, 0.64],
    'Salty water. Conducts weakly and freezes below −18°C.',
    {
      electrical: 0.4,
      coolant: true,
      hot: { at: 103, to: 7 },
      cold: { at: -18, to: 10 },
      heatCapacity: 4,
    },
  ),
  make(
    33,
    'Molten metal',
    'liquid',
    7,
    [1, 0.57, 0.21],
    'Hot conducting metal. Solidifies as it cools.',
    {
      temperature: 1500,
      emissive: 0.7,
      conductivity: 0.85,
      electrical: 1,
      cold: { at: 1350, to: 19 },
    },
  ),
  make(
    34,
    'Molten glass',
    'liquid',
    2.4,
    [0.94, 0.67, 0.33],
    'Viscous molten glass. Cools into a solid barrier.',
    { temperature: 1100, emissive: 0.4, viscosity: 0.85, cold: { at: 950, to: 20 } },
  ),
];
Object.assign(base[1], { hardness: 999999 });
Object.assign(base[2], {
  hardness: 36,
  debris: 12,
  reactions: [{ with: 22, to: 0, chance: 0.03, event: 3 }],
});
Object.assign(base[3], { hot: { at: 1500, to: 34 } });
Object.assign(base[4], {
  electrical: 0.22,
  coolant: true,
  reactions: [
    { with: 18, to: 0, chance: 0.002, event: 5 },
    { with: 23, to: 7, chance: 1, event: 2, temperature: 130 },
    { with: 15, to: 32, chance: 0.15, event: 3 },
  ],
});
Object.assign(base[5], { burnTicks: 150, residue: 9 });
Object.assign(base[8], {
  pattern: 1,
  burnTicks: 240,
  residue: 17,
  hardness: 15,
  debris: 25,
  reactions: [{ with: 22, to: 0, chance: 0.06, event: 3 }],
});
Object.assign(base[10], {
  pattern: 2,
  hardness: 15,
  debris: 21,
  reactions: [
    { with: 15, to: 4, chance: 0.1, event: 5, temperature: 0 },
    { with: 32, to: 4, chance: 0.02, event: 5, temperature: 0 },
  ],
});
Object.assign(base[11], { explosive: 22 });
additions.find((m) => m.id === 19)!.reactions = [
  ...additions.find((m) => m.id === 19)!.reactions!,
  { with: 22, to: 0, chance: 0.12, event: 3 },
];
export const materials: readonly Material[] = [...base, ...additions];
additions.find((m) => m.id === 20)!.pattern = 3;

// Pair probabilities share an unordered coordinate hash on both sides of a contact.
export function reactionsGLSL(): string {
  return `vec3 react(int id,int other,float r){\n${materials.flatMap((m) => (m.reactions ?? []).map((v) => `if(id==${m.id}&&other==${v.with}&&r<${f(v.chance)})return vec3(${f(v.to)},${f(v.event)},${f(v.temperature ?? -99999)});`)).join('\n')}\nreturn vec3(-1,0,-99999);}`;
}
export function physicsGLSL(): string {
  return `struct Physics { float burn; int residue; float blast; float hardness; int debris; float electric; bool source; float growth; bool coolant; };
Physics phys(int id){vec4 a=texelFetch(uMaterials,ivec2(id,4),0),b=texelFetch(uMaterials,ivec2(id,5),0),c=texelFetch(uMaterials,ivec2(id,6),0);return Physics(a.z,int(a.w),b.x,b.y,int(b.z),b.w,c.x>0.0,c.y,c.z>0.0);}`;
}
const phaseIds: Record<Phase, number> = { empty: 0, solid: 1, powder: 2, liquid: 3, gas: 4 };
const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));
export function materialGLSL(): string {
  return `uniform highp sampler2D uMaterials;
struct Property { float density; int phase; float viscosity; float conductivity; float capacity; float emissive; vec3 color; float ignition; int burnTo; float lifetime; int decayTo; float hot; int hotTo; float cold; int coldTo; float initialTemp; };
Property prop(int id){
 vec4 a=texelFetch(uMaterials,ivec2(id,0),0),b=texelFetch(uMaterials,ivec2(id,1),0),c=texelFetch(uMaterials,ivec2(id,2),0),d=texelFetch(uMaterials,ivec2(id,3),0),e=texelFetch(uMaterials,ivec2(id,4),0);
 return Property(a.x,int(a.y),a.z,a.w,b.x,b.y,c.rgb,b.z,int(b.w),c.w,int(d.x),d.y,int(d.z),d.w,int(e.x),e.y);
}`;
}
export function materialData(): Float32Array {
  const data = new Float32Array(materials.length * 7 * 4);
  for (const m of materials) {
    const rows = [
      [m.density, phaseIds[m.phase], m.viscosity, m.conductivity],
      [m.heatCapacity, m.emissive, m.ignition ?? 99999, m.burnTo ?? 0],
      [...m.color, m.lifetime ?? 0],
      [m.decayTo ?? 0, m.hot?.at ?? 99999, m.hot?.to ?? m.id, m.cold?.at ?? -99999],
      [m.cold?.to ?? m.id, m.temperature, m.burnTicks ?? 0, m.residue ?? 0],
      [m.explosive ?? 0, m.hardness ?? 8, m.debris ?? 0, m.electrical ?? 0],
      [m.chargeSource ? 1 : 0, m.growth ?? 0, m.coolant ? 1 : 0, m.pattern ?? 0],
    ];
    rows.forEach((row, y) => data.set(row, (y * materials.length + m.id) * 4));
  }
  return data;
}
