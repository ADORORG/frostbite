// The three rounds, laid out in millimetres. The same numbers place the rocks, islets, pillars, crates and cages in Blender (through
// art/layout.json, written from this file), so what the player sees is what the rules collide with.
export type Circle = readonly [x: number, y: number, r: number];
export type Point = readonly [x: number, y: number];

export interface Waves {
  // By wave (a new wave every fifteen seconds of the round): snowball speed, ticks between snowballs and ticks between darts (0: none).
  readonly speed: readonly number[];
  readonly every: readonly number[];
  readonly dartEvery: readonly number[];
  // Every so many snowballs, one is aimed at the player; in the last round every so many is a big one (0: never).
  readonly aimedEvery: number;
  readonly bigEvery: number;
}

export interface Level {
  readonly id: "floe" | "sound" | "crown";
  // Where the player may stand: one or more circles. Off them is water (or a fall).
  readonly land: readonly Circle[];
  // Rocks and pillars: never break.
  readonly solids: readonly Circle[];
  readonly crates: readonly Point[];
  readonly cages: readonly Point[];
  readonly start: Point;
  // Snowballs start on a circle around this centre, aim within `aimRadius` of it and are gone past `dropRadius`.
  readonly rollCentre: Point;
  readonly spawnRadius: number;
  readonly aimRadius: number;
  readonly dropRadius: number;
  readonly dartRadius: number;
  // Whether a snowball leaving the land falls into water (a splash) or off a cliff (a plunge).
  readonly drop: "splash" | "plunge";
  readonly waves: Waves;
}

// A cage is a ring of ice spikes around an egg: eight solid circles until a grown player breaks it.
export const cageRing: readonly Point[] = [
  [0, -1350],
  [955, -955],
  [1350, 0],
  [955, 955],
  [0, 1350],
  [-955, 955],
  [-1350, 0],
  [-955, -955],
];
export const cageSpike = 520;
export const crateRadius = 520;
// How much of a rock's drawn size is solid.
export const solidShare = { part: 85, whole: 100 } as const;

const floe: Level = {
  aimRadius: 5000,
  cages: [],
  crates: [],
  dartRadius: 13000,
  drop: "splash",
  dropRadius: 9900,
  id: "floe",
  land: [[0, 0, 8800]],
  rollCentre: [0, 0],
  solids: [
    [2936, -9035, 1050],
    [8643, -4404, 800],
    [8940, 2905, 1200],
    [4530, 8520, 900],
    [-2763, 9037, 1100],
    [-8643, 4404, 850],
    [-8888, -3060, 1150],
    [-4358, -8554, 950],
  ],
  spawnRadius: 9300,
  start: [0, 1500],
  waves: {
    aimedEvery: 3,
    bigEvery: 0,
    dartEvery: [0, 300, 240, 200],
    every: [110, 95, 80, 66],
    speed: [43, 52, 61, 70],
  },
};

const sound: Level = {
  aimRadius: 3000,
  cages: [],
  crates: [
    [-2600, -1500],
    [2700, 1800],
    [7353, -9408],
    [-500, 12300],
    [-7253, -9408],
  ],
  dartRadius: 16500,
  drop: "splash",
  dropRadius: 5900,
  id: "sound",
  land: [
    [0, 0, 5600],
    [7053, -9708, 2300],
    [11413, 3708, 2000],
    [0, 12000, 2400],
    [-11413, 3708, 2100],
    [-7053, -9708, 2200],
  ],
  rollCentre: [0, 0],
  solids: [],
  spawnRadius: 5300,
  start: [0, 2000],
  waves: {
    aimedEvery: 3,
    bigEvery: 0,
    dartEvery: [360, 300, 260, 220],
    every: [130, 110, 95, 80],
    speed: [46, 55, 64, 72],
  },
};

const crown: Level = {
  aimRadius: 6000,
  cages: [
    [0, -7300],
    [6943, -2256],
    [4291, 5906],
    [-4291, 5906],
    [-6943, -2256],
  ],
  crates: [],
  dartRadius: 13000,
  drop: "plunge",
  dropRadius: 9700,
  id: "crown",
  land: [[0, 0, 9200]],
  rollCentre: [0, 0],
  solids: [
    [3253, -3253, 700],
    [3253, 3253, 700],
    [-3253, 3253, 700],
    [-3253, -3253, 700],
  ],
  spawnRadius: 8900,
  start: [0, 1500],
  waves: {
    aimedEvery: 3,
    bigEvery: 4,
    dartEvery: [300, 250, 210, 180],
    every: [105, 90, 75, 62],
    speed: [48, 58, 68, 78],
  },
};

export const levels: readonly Level[] = [floe, sound, crown];
export const levelAt = (round: number): Level => levels[round] ?? floe;

// The islets of the second round are every land circle after the first.
export const isletCount = 5;
