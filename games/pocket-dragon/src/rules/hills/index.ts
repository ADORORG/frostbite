import type { GameVerifier } from "@ador/game-sdk/run-record";

import { verifierVersion } from "../constants.ts";
import { isItem } from "../kit.ts";
import { noSettings, playOn, stepChapter, type Chapter } from "../held.ts";
import { maxTicks } from "./constants.ts";
import { breathe } from "./fire.ts";
import { flap, pressJump } from "./hero.ts";
import { dig } from "./secrets.ts";
import { hillsEarned } from "./milestones.ts";
import { useKit } from "./powers.ts";
import { startHills } from "./state.ts";
import { tickHills } from "./tick.ts";
import { hillsControls, type HillsControl, type HillsState } from "./types.ts";

// EGG HILLS's rules as a pure state machine. Inputs: `left`, `right`, `jump`, `fire`, `down` and the backpack's `berry`, `mushroom` and
// `pineapple`, pressed or let go of, and `end`. A jump is remembered for a few ticks when pressed (with wings, in the air, it flaps at
// once); a fire press breathes a puff at once (once the fire berry is eaten); down digs into a burrow; a food is used at once. Once
// Glitchy has run out of hearts or reached the last portal, only `end` is taken.
export const hillsChapter: Chapter<HillsControl, HillsState> = {
  advanceTo: (state, tick) => playOn(state, tick, tickHills),
  controls: hillsControls,
  done: (state) => state.over || state.finishTick !== null,
  maxTicks,
  // Jump jumps (or, with wings, in the air, flaps); down on a burrow digs in; fire breathes.
  pressed(state, control) {
    const { hero } = state;
    if (control === "jump")
      return {
        ...state,
        hero:
          state.wings > 0 && !hero.grounded && hero.coyote === 0
            ? flap(hero)
            : pressJump(hero),
      };
    if (control === "down") return dig(state);
    if (isItem(control)) return useKit(state, control);
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
