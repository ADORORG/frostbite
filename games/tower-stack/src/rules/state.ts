import { startState, stepInt, stepSeed } from "@frostbite/game-sdk/seeded";

import { baseWidth, fieldWidth } from "./constants.ts";
import { rangeOf } from "./block.ts";
import type { TowerState } from "./types.ts";

// Where the next block begins on its sweep, drawn from the seeded generator: a number of units along the whole there-and-back of its range.
export function drawPhase(
  generator: number,
  width: number,
): { readonly generator: number; readonly phase: number } {
  const drawn = stepInt(generator, rangeOf(width) * 2);
  return { generator: drawn.state, phase: drawn.value };
}

export function startTower(seed: number): TowerState {
  // The first number a seeded generator gives hardly differs between seeds that are close together, so the first block's place is drawn
  // from the second.
  const begun = drawPhase(stepSeed(startState(seed)).state, baseWidth);
  return {
    bestStreak: 0,
    byHair: false,
    ended: false,
    fives: 0,
    generator: begun.generator,
    height: 0,
    marathon: false,
    needle: false,
    over: false,
    perfects: 0,
    phase: begun.phase,
    regrown: false,
    startTick: 0,
    streak: 0,
    tick: 0,
    tidy: false,
    topX: (fieldWidth - baseWidth) / 2,
    wideLoad: false,
    width: baseWidth,
  };
}
