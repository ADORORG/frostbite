import type { GameVerifier } from "@ador/game-sdk/run-record";

import { startHearts, verifierVersion } from "../constants.ts";
import { noSettings, playOn, stepChapter, type Chapter } from "../held.ts";
import { freshPlasma } from "../plasma.ts";
import {
  charmCount,
  chestCount,
  clueCount,
  eggCount,
  lanternCount,
  maxTicks,
  partCount,
  size,
} from "./constants.ts";
import { launchEgg } from "./launch.ts";
import { generateWoods } from "./maze.ts";
import { woodsEarned as milestonesOf } from "./milestones.ts";
import { breatheFire, tickWoods } from "./tick.ts";
import { woodsControls, type WoodsControl, type WoodsState } from "./types.ts";

// THE WHISPERING WOODS's rules as a pure state machine. Inputs: `left` and `right` turn, `up` walks on, `down` backs up, `fire`
// breathes (once per press), and `end`. Out through the moon gate, the same keys run the launch round: up and down tilt the launcher, left
// and right set its power, fire launches an egg. Once the round is over, only `end` is taken.
export function startWoods(
  seed: number,
  hearts: number = startHearts,
): WoodsState {
  const level = generateWoods(seed);
  return {
    angle: level.start.angle,
    breathTick: -1,
    breaths: 0,
    charms: Array.from({ length: charmCount }, () => false),
    chests: Array.from({ length: chestCount }, () => false),
    clues: Array.from({ length: clueCount }, () => false),
    controls: {
      down: false,
      fire: false,
      left: false,
      right: false,
      up: false,
    },
    eggs: Array.from({ length: eggCount }, () => false),
    ended: false,
    escaped: false,
    finishTick: null,
    fireCooldown: 0,
    found: null,
    hearts,
    heartsLost: 0,
    lanterns: Array.from({ length: lanternCount }, () => false),
    launch: null,
    level,
    melted: false,
    moonChest: false,
    parts: Array.from({ length: partCount }, () => false),
    plasma: freshPlasma(level.motes),
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
  done: (state) =>
    state.hearts <= 0 || (state.escaped && (state.launch?.ended ?? true)),
  maxTicks,
  pressed: (state, control) => {
    if (control !== "fire") return state;
    return state.escaped ? launchEgg(state) : breatheFire(state);
  },
};

export const woodsRules: GameVerifier<WoodsState> = {
  earned: milestonesOf,
  id: "woods",
  init: (seed, config) => noSettings(config, () => startWoods(seed)),
  step: (state, input) => stepChapter(woodsChapter, state, input),
  version: verifierVersion,
};
