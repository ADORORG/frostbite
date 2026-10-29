import type { Obstacle, RunnerState, Shard } from "../../src/rules/types.ts";
import { startRunner } from "../../src/rules/world.ts";

// A run with an empty, laid-out world (nothing ahead until the test puts something there), and a way to put things in it.
export const empty = (): RunnerState => ({
  ...startRunner(1),
  laidTo: 10 ** 9,
  obstacles: [],
  shards: [],
});

export const spike = (x: number): Obstacle => ({
  kind: "spike",
  lowestClearance: null,
  x,
});
export const icicle = (x: number): Obstacle => ({
  kind: "icicle",
  lowestClearance: null,
  x,
});
export const shard = (x: number, high = false): Shard => ({ high, x });

export const withWorld = (
  obstacles: readonly Obstacle[],
  shards: readonly Shard[] = [],
  over: Partial<RunnerState> = {},
): RunnerState => ({ ...empty(), obstacles, shards, ...over });
