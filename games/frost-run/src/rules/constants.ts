// Everything the rules measure, in whole numbers. A place is in millimetres on the floor (x to the east, y to the south, z up), a time
// is in ticks (sixty a second; the screen draws between them), and a speed is millimetres a tick. Nothing here is a float, so every
// engine plays a run out the same way.
export const gameId = "frost-run";
export const verifierId = "frost-run";
export const verifierVersion = 1;

export const ticksPerSecond = 60;
export const roundTicks = 60 * ticksPerSecond;
// The pause between rounds, while the next scene comes in.
export const interludeTicks = 4 * ticksPerSecond;
export const roundCount = 3;
// The longest a run may last: three full rounds and the two pauses between them, and so a bound on the work one replay does.
export const maxTicks =
  roundCount * roundTicks + (roundCount - 1) * interludeTicks;
// Two inputs are at least this many ticks apart, which keeps a run's record small whatever the hands do.
export const inputGapTicks = 3;

// What a hit costs: five seconds of the round's clock.
export const hitPenaltyTicks = 5 * ticksPerSecond;

// The player. Heights are of the body from its feet; a grown player is twice the size.
export const player = {
  airSteer: 10,
  duckHeight: 450,
  duckSpeed: 40,
  grownHeight: 2000,
  grownRadius: 840,
  grownSpeed: 95,
  height: 1000,
  hoverFall: 6,
  hoverSpeed: 75,
  hoverSteer: 6,
  hoverTicks: 110,
  hopSpeed: 126,
  gravity: 7,
  knockSpeed: 230,
  radius: 420,
  rollSpeed: 180,
  rollTicks: 26,
  rollCooldown: 70,
  runSpeed: 85,
  safeTicks: 80,
  steer: 5,
  stunTicks: 22,
} as const;

// The powers of the later rounds: how long each lasts and how long until it can be used again (from when it was used).
export const powers = {
  boltCooldown: 22,
  boltLife: 44,
  boltRadius: 220,
  boltSpeed: 250,
  growCooldown: 600,
  growTicks: 240,
  visionCooldown: 600,
  visionTicks: 210,
  // While frost vision holds, the world moves at a third of its speed and the clock at half.
  visionSlow: 3,
} as const;

// What the hands hold, as bits of one number: the direction is apart.
export const button = {
  duck: 2,
  grow: 8,
  hop: 1,
  shoot: 4,
  vision: 16,
} as const;
export const allButtons = 31;
// The ways a player can go: none, or one of sixteen.
export const noWay = -1;
export const wayCount = 16;

// The things to collect, how near the player must be to take one, and what each is worth.
export const reach = { crystal: 450, egg: 400, key: 420 } as const;
export const worth = { crystal: 100, egg: 150, key: 200 } as const;
export const perRound = { crystal: 8, egg: 5, key: 4 } as const;
// To win, a run must hold at least nine in ten of each kind (rounded up).
export const winShare = { part: 9, whole: 10 } as const;

// Snowballs and darts.
export const snowball = {
  bigFrom: 850,
  bigTo: 950,
  from: 380,
  incomingTicks: 45,
  to: 620,
} as const;
export const dart = {
  height: 800,
  radius: 150,
  speed: 150,
  telegraphTicks: 55,
} as const;
// A "close shave" is a snowball that passes this near without touching.
export const shaveGap = 160;
// Two crystals this close together in time are a pair.
export const pairTicks = 90;
