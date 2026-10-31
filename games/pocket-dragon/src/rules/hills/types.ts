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

export interface HillsLevel {
  readonly berry: Spot;
  readonly checkpointX: number;
  readonly eggs: readonly Spot[];
  readonly gloomSpeed: number;
  readonly goalX: number;
  readonly golden: Spot;
  // The top row of the ground in each column; a pit is `pitRow`.
  readonly ground: readonly number[];
  // Ice blocks, and where each is by `column * 64 + row`.
  readonly ice: readonly Cell[];
  readonly iceAt: ReadonlyMap<number, number>;
  readonly patrols: readonly Patrol[];
  // Floating tiles as `column * 64 + row`.
  readonly solid: ReadonlySet<number>;
  readonly stage: number;
  readonly thorns: readonly Spot[];
}

export type HillsControl = "fire" | "jump" | "left" | "right";
export const hillsControls: readonly HillsControl[] = [
  "left",
  "right",
  "jump",
  "fire",
];

export interface Hero {
  readonly buffer: number;
  readonly coyote: number;
  readonly facing: -1 | 1;
  readonly grounded: boolean;
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

export interface Fireball {
  readonly life: number;
  readonly vx: number;
  readonly x: number;
  readonly y: number;
}

export interface HillsState {
  readonly berryTaken: boolean;
  // Puffs of fire breathed, in the whole run.
  readonly breaths: number;
  readonly checkpoint: boolean;
  readonly cheers: number;
  readonly controls: Readonly<Record<HillsControl, boolean>>;
  readonly eggsBanked: number;
  readonly eggsTaken: readonly boolean[];
  readonly ended: boolean;
  readonly finishTick: number | null;
  readonly fireCooldown: number;
  readonly fireballs: readonly Fireball[];
  readonly glooms: readonly Gloom[];
  readonly goldenTaken: boolean;
  readonly goldens: number;
  readonly hasFire: boolean;
  readonly hearts: number;
  readonly heartsLost: number;
  readonly hero: Hero;
  readonly invulnerable: number;
  readonly level: HillsLevel;
  readonly melted: readonly boolean[];
  readonly meltedCount: number;
  readonly over: boolean;
  readonly seed: number;
  readonly stage: number;
  readonly stageStart: number;
  readonly stagesCleared: number;
  readonly tick: number;
}
