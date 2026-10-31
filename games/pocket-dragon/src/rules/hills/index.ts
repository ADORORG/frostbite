import type { GameVerifier } from "@ador/game-sdk/run-record";

import { verifierVersion } from "../constants.ts";
import { noSettings, playOn, stepChapter, type Chapter } from "../held.ts";
import { maxTicks } from "./constants.ts";
import { breathe } from "./fire.ts";
import { pressJump } from "./hero.ts";
import { hillsEarned } from "./milestones.ts";
import { startHills } from "./state.ts";
import { tickHills } from "./tick.ts";
import { hillsControls, type HillsControl, type HillsState } from "./types.ts";

// EGG HILLS's rules as a pure state machine. Inputs: `left`, `right`, `jump` and `fire` pressed or let go of, and `end`. A jump is
// remembered for a few ticks when pressed; a fire press breathes a puff at once (once the fire berry is eaten). Once Glitchy has run out
// of hearts or reached the last portal, only `end` is taken.
export const hillsChapter: Chapter<HillsControl, HillsState> = {
  advanceTo: (state, tick) => playOn(state, tick, tickHills),
  controls: hillsControls,
  done: (state) => state.over || state.finishTick !== null,
  maxTicks,
  pressed(state, control) {
    if (control === "jump") return { ...state, hero: pressJump(state.hero) };
    return control === "fire" ? breathe(state) : state;
  },
};

export const hillsRules: GameVerifier<HillsState> = {
  earned: hillsEarned,
  id: "hills",
  init: (seed, config) => noSettings(config, () => startHills(seed)),
  step: (state, input) => stepChapter(hillsChapter, state, input),
  version: verifierVersion,
};
