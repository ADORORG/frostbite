export type ObstacleKind = "boulder" | "pit" | "rock" | "spikes";

// Where an obstacle starts (`x`) and how wide (`w`) and high (`h`) it is, in sub-units from the top of the slope.
export interface Obstacle {
  readonly h: number;
  readonly kind: ObstacleKind;
  readonly w: number;
  readonly x: number;
}

export interface Shard {
  readonly x: number;
  readonly y: number;
}

export type Cleared = Readonly<Record<ObstacleKind, number>>;

// A run in progress. Nothing in it is a clock or a random source: the slope is laid out from the seed as the snowball comes to it.
export interface RunState {
  // The obstacles and shards laid ahead, nearest first.
  readonly ahead: readonly Obstacle[];
  // Ticks since the snowball left the snow, or 0 on it.
  readonly air: number;
  readonly alive: boolean;
  readonly bestStreak: number;
  // Ticks left in which a press still hops on landing, and ticks left in which the snowball can still hop after leaving the snow.
  readonly buffer: number;
  // Choices made so far (presses and lets-go).
  readonly choices: number;
  readonly cause: "fell" | "hit" | null;
  readonly cleared: Cleared;
  readonly closeCalls: number;
  readonly coyote: number;
  readonly distance: number;
  readonly ended: boolean;
  // The generator's state, advanced each time a pattern is laid.
  readonly generator: number;
  readonly holding: boolean;
  readonly hops: number;
  // The lowest the snowball's underside was over the rock it is passing, or null before that rock is reached.
  // The longest the snowball has been off the snow in one go (ticks), and the highest it has been (sub-units).
  readonly longest: number;
  readonly lowest: number | null;
  readonly nextAt: number;
  readonly peak: number;
  // Where the crevasse the snowball is over ends, or null.
  readonly pitEnd: number | null;
  readonly score: number;
  readonly shards: readonly Shard[];
  readonly shardsTaken: number;
  // Close calls in a row; a plain clear ends it.
  readonly streak: number;
  readonly tick: number;
  // Height of the snowball's underside over the snow, and its climb (up is positive).
  readonly vy: number;
  readonly y: number;
}
