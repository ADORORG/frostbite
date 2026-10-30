// A slab of the world's shape, as the level lays it out. None of it changes while a run is played: what changes is in `State`.
export interface Crate {
  readonly x: number;
  readonly y: number;
}

export interface Coin {
  readonly x: number;
  readonly y: number;
}

export interface Patrol {
  // The slime walks between these two places (subunits) and starts at `x`, going right.
  readonly maxX: number;
  readonly minX: number;
  readonly x: number;
  readonly y: number;
}

export interface Urchin {
  readonly x: number;
  readonly y: number;
}

export interface Level {
  readonly checkpointX: number;
  readonly coins: readonly Coin[];
  readonly crates: readonly Crate[];
  // The tile row of the top of the ground in each column; a pit is `pitRow`.
  readonly ground: readonly number[];
  readonly goalX: number;
  readonly patrols: readonly Patrol[];
  // How fast the slimes of this stage walk, and which stage it is (1 to `stages`).
  readonly slimeSpeed: number;
  readonly stage: number;
  // Floating tiles (platforms and crates) as `column * 64 + row`.
  readonly solid: ReadonlySet<number>;
  readonly urchins: readonly Urchin[];
}

export interface Controls {
  readonly jump: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export interface Slime {
  readonly alive: boolean;
  readonly dir: -1 | 1;
  readonly x: number;
}

export interface Hero {
  readonly buffer: number;
  readonly coyote: number;
  readonly grounded: boolean;
  readonly vx: number;
  readonly vy: number;
  readonly x: number;
  readonly y: number;
}

// A run in progress. Nothing in it is a clock or a random source: the level is laid out from the seed, and the rest follows from the
// inputs and the tick.
export interface State {
  // Stomps in a row without touching the ground, and the most there have been.
  readonly bestCombo: number;
  readonly checkpoint: boolean;
  // The shards taken on the stages cleared so far (`coinsTaken` is the stage being played).
  readonly coinsBanked: number;
  readonly coinsTaken: readonly boolean[];
  readonly combo: number;
  readonly controls: Controls;
  readonly cleanStages: number;
  readonly crates: number;
  readonly cratesUsed: readonly boolean[];
  readonly deaths: number;
  readonly ended: boolean;
  readonly farthest: number;
  // The fewest ticks a stage was cleared in (`maxTicks` until one has been).
  readonly fastest: number;
  // Set when the last stage is cleared.
  readonly finishTick: number | null;
  readonly hero: Hero;
  readonly hits: number;
  readonly invulnerable: number;
  readonly level: Level;
  readonly lives: number;
  readonly over: boolean;
  readonly perfectStages: number;
  readonly seed: number;
  readonly slimes: readonly Slime[];
  readonly stage: number;
  // The hits and falls the run had, and the tick it was, when the stage began.
  readonly stageLosses: number;
  readonly stageStart: number;
  // Stages cleared, the one just cleared included.
  readonly stagesCleared: number;
  readonly stomps: number;
  readonly tick: number;
}
