import type { GameVerifier } from "@ador/game-sdk/run-record";

import { verifierVersion } from "../constants.ts";
import { noSettings, playOn, stepChapter, type Chapter } from "../held.ts";
import {
  chestCount,
  clueCount,
  lanternCount,
  maxTicks,
  size,
} from "./constants.ts";
import { generateWoods } from "./maze.ts";
import { woodsEarned as milestonesOf } from "./milestones.ts";
import { breatheFire, tickWoods } from "./tick.ts";
import { woodsControls, type WoodsControl, type WoodsState } from "./types.ts";

// THE WHISPERING WOODS's rules as a pure state machine. Inputs: `left` and `right` turn, `up` walks on, `down` backs up, `fire`
// breathes (once per press), and `end`. Once Glitchy has stepped through the moon gate, only `end` is taken.
export function startWoods(seed: number): WoodsState {
  const level = generateWoods(seed);
  return {
    angle: level.start.angle,
    breathTick: -1,
    breaths: 0,
    chests: Array.from({ length: chestCount }, () => false),
    clues: Array.from({ length: clueCount }, () => false),
    controls: {
      down: false,
      fire: false,
      left: false,
      right: false,
      up: false,
    },
    ended: false,
    escaped: false,
    finishTick: null,
    fireCooldown: 0,
    found: null,
    lanterns: Array.from({ length: lanternCount }, () => false),
    level,
    melted: false,
    moonChest: false,
    seed,
    tick: 0,
    visited: Array.from({ length: size * size }, (_, at) => at === size + 1),
    x: level.start.x,
    y: level.start.y,
  };
}

export const woodsChapter: Chapter<WoodsControl, WoodsState> = {
  advanceTo: (state, tick) => playOn(state, tick, tickWoods),
  controls: woodsControls,
  done: (state) => state.escaped,
  maxTicks,
  pressed: (state, control) =>
    control === "fire" ? breatheFire(state) : state,
};

export const woodsRules: GameVerifier<WoodsState> = {
  earned: milestonesOf,
  id: "woods",
  init: (seed, config) => noSettings(config, () => startWoods(seed)),
  step: (state, input) => stepChapter(woodsChapter, state, input),
  version: verifierVersion,
};
