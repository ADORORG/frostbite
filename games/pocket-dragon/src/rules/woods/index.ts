import type { GameVerifier } from "@frostbite/game-sdk/run-record";

import { startHearts, verifierVersion } from "../constants.ts";
import { noSettings, playOn, stepChapter, type Chapter } from "../held.ts";
import { isItem, noKit, startPowers, type Kit } from "../kit.ts";
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
import { breathe, use } from "./actions.ts";
import { turn, walkable } from "./base.ts";
import { fly } from "./flight.ts";
import { withNews } from "./base-tick.ts";
import { generateWoods } from "./maze.ts";
import { woodsEarned as milestonesOf } from "./milestones.ts";
import { useKit } from "./powers.ts";
import { sendSparky } from "./sparky.ts";
import { frostVision } from "./vision.ts";
import { skipScene } from "./scenes.ts";
import { breatheFire, tickWoods } from "./tick.ts";
import { woodsControls, type WoodsControl, type WoodsState } from "./types.ts";

// THE WHISPERING WOODS's rules as a pure state machine. Inputs: the four ways, `fire`, `act` and the backpack's three foods, pressed or
// let go of, and `end`. A food is used at once, in the maze or out of it. In the maze, left and right turn, up walks on, down backs up,
// and fire (or act) breathes. Out of the maze the woods are seen from above:
// a way held walks tile by tile, fire breathes at the tile ahead, and act frees a caged dragon, opens a chest, fits a rocket key, or
// launches an egg. While a scene plays, act skips it. Once the rocket is defused (or has launched) and its scene is over, only `end` is
// taken.
export function startWoods(
  seed: number,
  hearts: number = startHearts,
  kit: Kit = noKit,
): WoodsState {
  const level = generateWoods(seed);
  return {
    angle: level.start.angle,
    breathTick: -1,
    breaths: 0,
    charms: Array.from({ length: charmCount }, () => false),
    chests: Array.from({ length: chestCount }, () => false),
    clues: Array.from({ length: clueCount }, () => false),
    base: null,
    controls: {
      act: false,
      berry: false,
      climb: false,
      dive: false,
      down: false,
      fire: false,
      help: false,
      left: false,
      mushroom: false,
      pineapple: false,
      right: false,
      up: false,
      vision: false,
    },
    eggs: Array.from({ length: eggCount }, () => false),
    ended: false,
    escapeTick: null,
    escaped: false,
    finishTick: null,
    fireCooldown: 0,
    found: null,
    hearts,
    heartsLost: 0,
    kitTaken: level.kit.map(() => false),
    lanterns: Array.from({ length: lanternCount }, () => false),
    level,
    melted: false,
    moonChest: false,
    outcome: null,
    parts: Array.from({ length: partCount }, () => false),
    plasma: freshPlasma(level.motes),
    plasmaSpent: 0,
    powers: startPowers(kit),
    scene: null,
    seed,
    tick: 0,
    visited: Array.from({ length: size * size }, (_, at) => at === size + 1),
    x: level.start.x,
    y: level.start.y,
  };
}

// The level is over once the rocket is defused or launched (or the hearts run out in the maze) and its scene has played.
export const woodsDone = (state: WoodsState): boolean =>
  state.scene === null && (state.hearts <= 0 || state.outcome !== null);

export const woodsChapter: Chapter<WoodsControl, WoodsState> = {
  advanceTo: (state, tick) => playOn(state, tick, tickWoods),
  controls: woodsControls,
  done: woodsDone,
  maxTicks,
  pressed: (state, control) => {
    if (state.scene !== null)
      return control === "act" ? skipScene(state) : state;
    if (isItem(control)) return withNews(state, useKit(state, control));
    const { base } = state;
    if (base === null)
      return control === "fire" || control === "act"
        ? breatheFire(state)
        : state;
    if (control === "fire") return withNews(state, breathe(state, base));
    if (control === "act") return withNews(state, use(state, base));
    if (control === "climb" || control === "dive")
      return fly(state, base, control === "climb", (x, y) =>
        walkable(base, x, y),
      );
    if (control === "vision") return frostVision(state, base);
    if (control === "help") return sendSparky(state, base);
    return { ...state, base: turn(base, control) };
  },
};

export const woodsRules: GameVerifier<WoodsState> = {
  earned: milestonesOf,
  id: "woods",
  init: (seed, config) => noSettings(config, () => startWoods(seed)),
  step: (state, input) => stepChapter(woodsChapter, state, input),
  version: verifierVersion,
};
