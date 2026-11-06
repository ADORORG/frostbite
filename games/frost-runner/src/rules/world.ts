import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import {
  baseSpeed,
  firstObstacleAt,
  gapBase,
  gapPerSpeed,
  gapVariety,
  highShardHeight,
  icicleWidth,
  shardChancePercent,
  shardRunLength,
  shardSpacing,
  spawnHorizon,
  speedStepUnits,
  spikeChancePercent,
  spikeWidth,
  topSpeedBonus,
} from "./constants.ts";
import type { Obstacle, RunnerState, Shard } from "./types.ts";

// How fast the world moves at a distance: it speeds up by one every `speedStepUnits`, up to a top speed.
export const speedAt = (distance: number): number =>
  baseSpeed + Math.min(topSpeedBonus, Math.floor(distance / speedStepUnits));

export const widthOf = (obstacle: Obstacle): number =>
  obstacle.kind === "spike" ? spikeWidth : icicleWidth;

export function startRunner(seed: number): RunnerState {
  return spawnAhead({
    action: { kind: "none", tick: 0 },
    alive: true,
    cleared: 0,
    closeCalls: 0,
    distance: 0,
    ended: false,
    generator: startState(seed),
    highShards: 0,
    jumps: 0,
    laidTo: firstObstacleAt - gapBase,
    obstacles: [],
    shards: [],
    shardsTaken: 0,
    slides: 0,
    tick: 0,
  });
}

// Lays out obstacles (and sometimes a run of shards before one) until the world is laid out as far ahead as the runner can see. The
// gap between two obstacles grows with speed, so there is always time to react, and varies, so no run is a pattern to learn.
export function spawnAhead(state: RunnerState): RunnerState {
  let { generator, laidTo } = state;
  const obstacles: Obstacle[] = [...state.obstacles];
  const shards: Shard[] = [...state.shards];
  const speed = speedAt(state.distance);
  while (laidTo < spawnHorizon) {
    const gap = stepInt(generator, gapVariety);
    const kind = stepInt(gap.state, 100);
    const shardRoll = stepInt(kind.state, 100);
    generator = shardRoll.state;
    const at = laidTo + gapBase + speed * gapPerSpeed + gap.value;
    const spike = kind.value < spikeChancePercent;
    obstacles.push({
      kind: spike ? "spike" : "icicle",
      lowestClearance: null,
      x: at,
    });
    if (shardRoll.value < shardChancePercent)
      for (let index = 0; index < shardRunLength; index += 1)
        shards.push({
          high: spike,
          x:
            (spike ? at - shardSpacing : at - 3 * shardSpacing) +
            index * shardSpacing,
        });
    laidTo = at + (spike ? spikeWidth : icicleWidth);
  }
  return { ...state, generator, laidTo, obstacles, shards };
}

export const shardHeight = (shard: Shard): number =>
  shard.high ? highShardHeight : 0;
