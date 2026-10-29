export type ObstacleKind = "icicle" | "spike";

export interface Obstacle {
  readonly kind: ObstacleKind;
  // The lowest the runner's feet were over a spike while it passed (a close call when this is small), or null before it is reached.
  readonly lowestClearance: number | null;
  readonly x: number;
}

export interface Shard {
  readonly high: boolean;
  readonly x: number;
}

export type Action =
  | { readonly kind: "jump" | "slide"; readonly tick: number }
  | { readonly kind: "none"; readonly tick: 0 };

// A run in progress. Nothing in it is a clock or a random source: the world is laid out from `generator`, a seeded generator's state.
export interface RunnerState {
  readonly action: Action;
  readonly alive: boolean;
  readonly cleared: number;
  readonly closeCalls: number;
  readonly distance: number;
  readonly ended: boolean;
  // A seeded generator's state, which lays out the world.
  readonly generator: number;
  readonly highShards: number;
  // The furthest edge anything has been laid out to, in units from the runner (it shrinks as the world scrolls).
  readonly laidTo: number;
  readonly jumps: number;
  readonly obstacles: readonly Obstacle[];
  readonly shards: readonly Shard[];
  readonly shardsTaken: number;
  readonly slides: number;
  readonly tick: number;
}
