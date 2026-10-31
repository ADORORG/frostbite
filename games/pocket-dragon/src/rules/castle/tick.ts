import { startState, stepInt } from "@ador/game-sdk/seeded";

import { moves, perform, pick, reply } from "./battle.ts";
import { stepTicks, trailLength } from "./constants.ts";
import { boulders, brambles, foes, friends, items, start } from "./places.ts";
import { ahead, arrive, breathe, interact, walkable } from "./world.ts";
import type { CastleControl, CastleState, Facing } from "./types.ts";

export function startCastle(seed: number): CastleState {
  let rng = startState(seed ^ 0x5eed_0003);
  const favourites = foes.map(() => {
    const rolled = stepInt(rng, moves.length);
    rng = rolled.state;
    return rolled.value;
  });
  return {
    bannerRaised: false,
    battle: null,
    cheered: foes.map(() => false),
    controls: {
      act: false,
      down: false,
      fire: false,
      left: false,
      right: false,
      up: false,
    },
    crossedRiver: false,
    ended: false,
    escapedWoods: false,
    facing: "down",
    favourites,
    finishTick: null,
    fireTick: -1,
    friends: friends.map(() => false),
    held: items.map(() => false),
    lilies: false,
    melted: false,
    message: null,
    naps: 0,
    opened: brambles.map(() => false),
    perfectPicks: 0,
    pushed: boulders.map(() => false),
    rng,
    seed,
    step: null,
    taken: items.map(() => false),
    tick: 0,
    trail: [],
    x: start.x,
    y: start.y,
  };
}

const directions: readonly Facing[] = ["up", "down", "left", "right"];
const isDirection = (control: CastleControl): control is Facing =>
  directions.some((d) => d === control);

// What a press does at once: in a cheer challenge it moves the menu or puts on the show; out of one, a way pressed turns Glitchy and
// bumps into what is there, `act` talks to (or uses) what is ahead, and `fire` breathes.
export function pressCastle(
  state: CastleState,
  control: CastleControl,
): CastleState {
  if (state.battle !== null) {
    if (control === "act") return perform(state);
    if (control === "left" || control === "up") return pick(state, -1);
    return control === "right" || control === "down" ? pick(state, 1) : state;
  }
  if (control === "fire") return breathe(state);
  const facing = isDirection(control) ? control : state.facing;
  const turned = { ...state, facing };
  if (state.step !== null) return turned;
  const { x, y } = ahead[facing];
  if (control === "act" || !walkable(turned, state.x + x, state.y + y))
    return interact(turned, state.x + x, state.y + y);
  return turned;
}

// One tick: a challenge's reply comes when its show is over; a step finishes; or, with a way held, the next step begins.
export function tickCastle(before: CastleState): CastleState {
  const state = { ...before, tick: before.tick + 1 };
  if (state.bannerRaised) return state;
  if (state.battle !== null) return reply(state);
  if (state.step !== null)
    return state.tick - state.step.start >= stepTicks
      ? arrive({ ...state, step: null })
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
