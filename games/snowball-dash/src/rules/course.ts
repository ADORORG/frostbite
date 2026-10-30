import { startState, stepInt } from "@ador/game-sdk/seeded";

import {
  baseSpeed,
  courseUnits,
  finishClearance,
  firstRockAt,
  gapVariety,
  minGap,
  speedStepUnits,
  topSpeedBonus,
} from "./constants.ts";
import type { SnowballState } from "./types.ts";

// How fast the snowball rolls at a distance: faster by one every `speedStepUnits`, up to a top speed.
export const speedAt = (distance: number): number =>
  baseSpeed + Math.min(topSpeedBonus, Math.floor(distance / speedStepUnits));

// The rocks of a slope, from its seed: the same seed always gives the same slope, and a gap is never less than `minGap`, so a hop
// is always possible in time.
export function layRocks(seed: number): readonly number[] {
  const rocks: number[] = [];
  let generator = startState(seed);
  let at = firstRockAt;
  while (at <= courseUnits - finishClearance) {
    rocks.push(at);
    const gap = stepInt(generator, gapVariety);
    generator = gap.state;
    at += minGap + gap.value;
  }
  return rocks;
}

export const startSnowball = (seed: number): SnowballState => ({
  air: 0,
  alive: true,
  cleared: 0,
  closeCalls: 0,
  distance: 0,
  ended: false,
  finished: false,
  hops: 0,
  lowestClearance: null,
  rocks: layRocks(seed),
  tick: 0,
});
