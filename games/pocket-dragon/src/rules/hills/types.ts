import type { KitSpot, Powers } from "../kit.ts";
import type { Plasma } from "../plasma.ts";

// The shape of Egg Hills: a level (laid out from the seed, never changed while it is played) and the run going on in it.
export interface Spot {
  readonly x: number;
  readonly y: number;
}

export interface Cell {
  readonly column: number;
  readonly row: number;
}

export interface Patrol {
  // A gloomling walks between `minX` and `maxX`, starting at `x`, going right.
  readonly maxX: number;
  readonly minX: number;
  readonly x: number;
  readonly y: number;
}

export type Weather = "fog" | "rain" | "wind";

// A steam vent on the ground (puffing on and off from its phase), and a boulder rolling between two places on the ground.
export interface Vent {
  readonly phase: number;
  readonly x: number;
  readonly y: number;
}

export interface Roller {
  readonly maxX: number;
  readonly minX: number;
  readonly phase: number;
  readonly y: number;
}

export interface HillsLevel {
  readonly berry: Spot;
  // The secret charm, high up off the path: a feather in stage one, a shield in stage two, a magnet in stage three.
  readonly charm: Spot;
  readonly checkpointX: number;
  // The swirl cloud into the sky, high over a spring.
  readonly cloudGate: Spot;
  readonly eggs: readonly Spot[];
  readonly gloomSpeed: number;
  readonly goalX: number;
  readonly golden: Spot;
  // The forcefield bubble and the wings, one of each a stage.
  readonly forcefield: Spot;
  readonly wings: Spot;
  // The burrow into the tunnel (the top of its tile of ground).
  readonly burrow: Spot;
  // The top row of the ground in each column of the stage and its two secret areas; a pit is `pitRow`, a wall `wallRow`.
  readonly ground: readonly number[];
  // The backpack's foods lying along the way (`kit-layout.ts`).
  readonly kit: readonly KitSpot[];
  // Ice blocks, and where each is by `column * 64 + row`.
  readonly ice: readonly Cell[];
  readonly iceAt: ReadonlyMap<number, number>;
  // Metaplasma, sorted by `x` (see `../plasma.ts`).
  readonly motes: readonly Spot[];
  readonly patrols: readonly Patrol[];
  readonly rollers: readonly Roller[];
  // Where the sky comes down to, past the swirl cloud; and the rainbow at the sky's far end that takes Glitchy there.
  readonly skyEnd: Spot;
  readonly skyExit: number;
  // Floating tiles as `column * 64 + row`.
  readonly solid: ReadonlySet<number>;
  readonly springs: readonly Spot[];
  readonly stage: number;
  readonly thorns: readonly Spot[];
  // The pipe at the tunnel's far end, which comes out at `tunnelExit` (the nest).
  readonly tunnelEnd: Spot;
  readonly tunnelExit: number;
  readonly vents: readonly Vent[];
  readonly weather: Weather;
}

// The ways, jump, fire and down, and the backpack's three foods (each used at once when pressed).
export type HillsControl =
  | "berry"
  | "down"
  | "fire"
  | "jump"
  | "left"
  | "mushroom"
  | "pineapple"
  | "right";
export const hillsControls: readonly HillsControl[] = [
  "left",
  "right",
  "jump",
  "fire",
  "down",
  "berry",
  "mushroom",
  "pineapple",
];

export interface Hero {
  readonly buffer: number;
  readonly coyote: number;
  readonly facing: -1 | 1;
  readonly grounded: boolean;
  // Thrown by a spring: the jump is not cut short when jump is let go of, until Glitchy lands.
  readonly sprung: boolean;
  readonly vx: number;
  readonly vy: number;
  readonly x: number;
  readonly y: number;
}

export interface Gloom {
  readonly alive: boolean;
  // The tick it was cheered up, for the puff the screen draws; -1 while it is still grumpy.
  readonly cheered: number;
  readonly dir: -1 | 1;
  readonly x: number;
}

// The boss fight at the end of a stage. DeFu stays on her ledge and is never hurt; her baby ghost dragons (and in the last stage
// her egg rocket) are what Glitchy must beat to unseal the portal. A ghost's height follows the clock (`ghostY` in `boss.ts`).
export interface Ghost {
  readonly dir: -1 | 1;
  // The tick it was beaten (it turns to sparkles and floats away), or -1.
  readonly freed: number;
  readonly hp: number;
  // Ticks it flashes after a hit, when it cannot be hit again.
  readonly hurt: number;
  readonly phase: number;
  readonly x: number;
}

// A security guard she sends down: it walks toward Glitchy, and is sent home dizzy by a stomp or a puff of fire.
export interface Guard {
  readonly dir: -1 | 1;
  readonly x: number;
}

export interface Rocket {
  readonly dir: -1 | 1;
  readonly hp: number;
  readonly hurt: number;
  readonly x: number;
}

export interface FreedEgg {
  readonly caught: boolean;
  readonly vx: number;
  readonly vy: number;
  readonly x: number;
  readonly y: number;
}

// Red eyes, then laser strikes on the marked spots.
export interface Strike {
  readonly marks: readonly number[];
  readonly start: number;
}

export interface Boss {
  // The tick it was won, or -1; the tick it began (Glitchy came into the arena), or -1.
  readonly beaten: number;
  readonly freed: readonly FreedEgg[];
  readonly ghosts: readonly Ghost[];
  readonly guards: readonly Guard[];
  readonly launched: number;
  readonly rng: number;
  readonly rocket: Rocket | null;
  readonly started: number;
  readonly strike: Strike | null;
}

// A glitch blast rolling along the ground (`blast.ts`).
export interface Blast {
  readonly life: number;
  readonly vx: number;
  readonly vy: number;
  readonly x: number;
  readonly y: number;
}

export interface Fireball {
  readonly life: number;
  readonly vx: number;
  readonly x: number;
  readonly y: number;
}

export interface HillsState {
  readonly berryTaken: boolean;
  readonly blasts: readonly Blast[];
  readonly boss: Boss;
  // Puffs of fire breathed, in the whole run.
  readonly breaths: number;
  // This stage's charm has been found; `charms` counts them in the run, and the three powers last the run (the shield until used).
  readonly charmTaken: boolean;
  readonly charms: number;
  readonly checkpoint: boolean;
  readonly cheers: number;
  readonly controls: Readonly<Record<HillsControl, boolean>>;
  readonly eggsBanked: number;
  readonly eggsTaken: readonly boolean[];
  readonly ended: boolean;
  readonly feather: boolean;
  readonly finishTick: number | null;
  readonly fireCooldown: number;
  // Ticks of the forcefield left, and whether this stage's bubble has been taken.
  readonly forcefield: number;
  readonly forceTaken: boolean;
  readonly fireballs: readonly Fireball[];
  // Eggs caught from the burst egg rocket, and security guards cheered up, in the run.
  readonly freedCaught: number;
  readonly glooms: readonly Gloom[];
  readonly goldenTaken: boolean;
  readonly goldens: number;
  readonly guardsCheered: number;
  readonly hasFire: boolean;
  readonly hearts: number;
  readonly heartsLost: number;
  readonly hero: Hero;
  readonly invulnerable: number;
  // Which of this stage's foods have been picked up, and the backpack with what it does (`../kit.ts`).
  readonly kitTaken: readonly boolean[];
  readonly level: HillsLevel;
  readonly magnet: boolean;
  readonly melted: readonly boolean[];
  readonly meltedCount: number;
  readonly over: boolean;
  // This stage's metaplasma, and what earlier stages of the run gathered.
  readonly plasma: Plasma;
  readonly plasmaBanked: number;
  readonly powers: Powers;
  // This stage's boulders and thorn bushes glitched away by a blast.
  readonly rollersGone: readonly boolean[];
  // Secret areas found in the run (a tunnel and a sky each stage), and whether this stage's have been.
  readonly secretsFound: number;
  readonly seed: number;
  readonly shield: boolean;
  readonly skyFound: boolean;
  readonly stage: number;
  readonly stageStart: number;
  readonly stagesCleared: number;
  readonly thornsGone: readonly boolean[];
  readonly tick: number;
  readonly tunnelFound: boolean;
  // Ticks of the wings left, and whether this stage's wings have been taken.
  readonly wings: number;
  readonly wingsTaken: boolean;
}
