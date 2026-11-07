import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import { startHearts } from "../constants.ts";
import { isItem, noKit, startPowers, wearOff, type Kit } from "../kit.ts";
import { freshPlasma, pullPlasma } from "../plasma.ts";
import {
  act,
  charmMove,
  evadeMove,
  moves,
  perform,
  pick,
  quickMove,
  reply,
  showsOf,
} from "./battle.ts";
import {
  plasmaCatch,
  plasmaReach,
  plasmaSpeed,
  trailLength,
} from "./constants.ts";
import { castleMotes } from "./motes.ts";
import {
  boulders,
  brambles,
  charmSpots,
  foes,
  friends,
  items,
  kitSpots,
  start,
} from "./places.ts";
import { rollBlast, takeKit, useKit } from "./powers.ts";
import { stepOf } from "./guild.ts";
import { guardsTick, nightFalls } from "./night.ts";
import { rooms } from "./rooms.ts";
import { ahead, arrive, breathe, interact, land, walkable } from "./world.ts";
import type { CastleControl, CastleState, Facing, Spot } from "./types.ts";

export function startCastle(
  seed: number,
  hearts: number = startHearts,
  kit: Kit = noKit,
): CastleState {
  let rng = startState(seed ^ 0x5eed_0003);
  const favourites = foes.map(() => {
    const rolled = stepInt(rng, moves.length);
    rng = rolled.state;
    return rolled.value;
  });
  return {
    battle: null,
    blast: null,
    charms: charmSpots.map(() => false),
    charmsUsed: charmSpots.map(() => false),
    cheered: foes.map(() => false),
    clues: rooms.map(() => false),
    controls: {
      act: false,
      berry: false,
      charm: false,
      down: false,
      evade: false,
      fire: false,
      left: false,
      mushroom: false,
      pineapple: false,
      quick: false,
      right: false,
      show1: false,
      show2: false,
      show3: false,
      show4: false,
      show5: false,
      up: false,
    },
    crossedRiver: false,
    eggs: [],
    ended: false,
    escapedWoods: false,
    evades: 0,
    facing: "down",
    favourites,
    finishTick: null,
    fireTick: -1,
    forceTaken: false,
    forcefield: 0,
    friends: friends.map(() => false),
    gateOpen: false,
    gear: rooms.map(() => false),
    goldenEgg: false,
    guards: [],
    hearts,
    heartsLost: 0,
    held: items.map(() => false),
    invulnerable: 0,
    kitTaken: kitSpots.map(() => false),
    lilies: false,
    melted: false,
    message: null,
    naps: 0,
    opened: brambles.map(() => false),
    perfectPicks: 0,
    phase: "day",
    phaseTick: 0,
    plasma: freshPlasma(castleMotes),
    powers: startPowers(kit),
    pushed: boulders.map(() => false),
    rng,
    room: -1,
    seed,
    step: null,
    stuns: 0,
    taken: items.map(() => false),
    tick: 0,
    trail: [],
    x: start.x,
    y: start.y,
  };
}

const directions: readonly Facing[] = ["up", "down", "left", "right"];
const hotkeys: Partial<Record<CastleControl, number>> = {
  charm: charmMove,
  evade: evadeMove,
  quick: quickMove,
  show1: 0,
  show2: 1,
  show3: 2,
  show4: 3,
  show5: 4,
};

// Where Glitchy is, in pixels, part way along a step: for metaplasma (and the screen).
export function standingAt(state: CastleState): Spot {
  const to = { x: state.x * 16 + 8, y: state.y * 16 + 8 };
  if (state.step === null) return to;
  const ticks = stepOf(state);
  const part = Math.min(ticks, state.tick - state.step.start);
  const from = { x: state.step.from.x * 16 + 8, y: state.step.from.y * 16 + 8 };
  return {
    x: from.x + Math.trunc(((to.x - from.x) * part) / ticks),
    y: from.y + Math.trunc(((to.y - from.y) * part) / ticks),
  };
}
const isDirection = (control: CastleControl): control is Facing =>
  directions.some((d) => d === control);

// What a press does at once: in a cheer challenge it moves the menu or puts on the show, and a hotkey makes its move at once; out of one,
// a way pressed turns Glitchy and bumps into what is there, `act` talks to (or uses) what is ahead, `fire` breathes, a food from the
// backpack is used, and the hotkeys do nothing.
export function pressCastle(
  state: CastleState,
  control: CastleControl,
): CastleState {
  const hot = hotkeys[control];
  if (state.battle !== null) {
    if (control === "act") return perform(state);
    if (control === "left" || control === "up") return pick(state, -1);
    if (control === "right" || control === "down") return pick(state, 1);
    if (hot === undefined) return state;
    return hot === charmMove || hot >= quickMove || showsOf(state).includes(hot)
      ? act(state, hot)
      : { ...state, message: { id: "not-yet", tick: state.tick } };
  }
  if (hot !== undefined) return state;
  if (isItem(control)) return useKit(state, control);
  if (control === "fire") return breathe(state);
  const facing = isDirection(control) ? control : state.facing;
  const turned = { ...state, facing };
  if (state.step !== null) return turned;
  const { x, y } = ahead[facing];
  if (control === "act" || !walkable(turned, state.x + x, state.y + y))
    return interact(turned, state.x + x, state.y + y);
  return turned;
}

// One tick: metaplasma drifts to Glitchy (outdoors); the blinking and the forcefield wear off; night falls once the guild is whole and
// winter comes once every egg is saved; the guards step; a challenge's reply comes when its show is over; a step finishes; or, with a way
// held, the next step begins. Once the golden egg is taken, or the hearts are gone, only the clock goes on.
export function tickCastle(before: CastleState): CastleState {
  const at = standingAt(before);
  const timed = {
    ...before,
    forcefield: Math.max(0, before.forcefield - 1),
    invulnerable: Math.max(0, before.invulnerable - 1),
    plasma:
      before.room >= 0
        ? before.plasma
        : pullPlasma(before.plasma, castleMotes, at.x, at.y, {
            catchWithin: plasmaCatch,
            reach: plasmaReach,
            speed: plasmaSpeed,
          }),
    powers: wearOff(before.powers),
    tick: before.tick + 1,
  };
  if (timed.goldenEgg || timed.hearts <= 0) return timed;
  if (timed.battle !== null) return reply(timed);
  const fallen = nightFalls(timed);
  const state = rollBlast(guardsTick(fallen, (x, y) => land(fallen, x, y)));
  if (state.step !== null)
    return state.tick - state.step.start >= stepOf(state)
      ? takeKit(arrive({ ...state, step: null }))
      : state;
  const way = state.controls[state.facing]
    ? state.facing
    : directions.find((d) => state.controls[d]);
  if (way === undefined) return state;
  const { x, y } = ahead[way];
  if (!walkable(state, state.x + x, state.y + y))
    return { ...state, facing: way };
  return {
    ...state,
    facing: way,
    step: { from: { x: state.x, y: state.y }, start: state.tick },
    trail: [{ x: state.x, y: state.y }, ...state.trail].slice(0, trailLength),
    x: state.x + x,
    y: state.y + y,
  };
}
