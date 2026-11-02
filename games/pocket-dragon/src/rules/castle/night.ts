import {
  bumpDizzy,
  dizzyTicks,
  forceTicks,
  guardStep,
  helmReach,
  fireReach,
  invulnerableTicks,
} from "./constants.ts";
import { stepToward as stepOn } from "../grid.ts";
import { friendsJoined } from "./guild.ts";
import { mapHeight, mapWidth } from "./map.ts";
import { bubble, cage, friends, guardStarts, nightEggs } from "./places.ts";
import type { CastleState, NightEgg, NightGuard, Spot } from "./types.ts";

// The night: DeFu's security guards go after the eggs, carry them to their cage, and chase Glitchy once none is left loose. A guard
// steps along the shortest way (the first found, trying up, down, left, right). A puff of fire leaves a guard dizzy and makes it drop what
// it carries; Glitchy walking onto a loose egg saves it, and opening the cage saves every egg in it. A guard that bumps into Glitchy
// costs a heart (unless Glitchy is blinking or has the forcefield) and is dizzy a while after. Saving every egg brings the winter.
const say = (state: CastleState, id: string): CastleState => ({
  ...state,
  message: { id, tick: state.tick },
});

// The first step from `from` toward the nearest tile that `target` names, over tiles `open` allows, on the guild's land.
export const stepToward = (
  from: Spot,
  target: (x: number, y: number) => boolean,
  open: (x: number, y: number) => boolean,
): Spot | null => stepOn(mapWidth, mapHeight, from, target, open);

export function nightFalls(state: CastleState): CastleState {
  if (state.phase === "day" && friendsJoined(state) >= friends.length)
    return say(
      {
        ...state,
        eggs: nightEggs.map((spot) => ({ ...spot, state: "loose" as const })),
        guards: guardStarts.map((spot, at) => ({
          ...spot,
          carrying: -1,
          dizzy: 0,
          moved: state.tick + at * 5,
        })),
        phase: "night",
        phaseTick: state.tick,
      },
      "night",
    );
  if (
    state.phase === "night" &&
    state.eggs.every((egg) => egg.state === "saved")
  )
    return say(
      { ...state, guards: [], phase: "winter", phaseTick: state.tick },
      "winter",
    );
  return state;
}

const dropped = (
  eggs: readonly NightEgg[],
  guard: NightGuard,
): readonly NightEgg[] =>
  eggs.map((egg, at) =>
    at === guard.carrying ? { state: "loose", x: guard.x, y: guard.y } : egg,
  );

// Glitchy bumped by a guard: a heart, unless blinking or shielded; the guard drops its egg and is dizzy a while.
function bumped(state: CastleState, at: number): CastleState {
  const guard = state.guards[at];
  if (guard === undefined) return state;
  const hurt = state.invulnerable === 0 && state.forcefield === 0;
  return say(
    {
      ...state,
      eggs: dropped(state.eggs, guard),
      guards: state.guards.map((other, index) =>
        index === at ? { ...other, carrying: -1, dizzy: bumpDizzy } : other,
      ),
      hearts: state.hearts - (hurt ? 1 : 0),
      heartsLost: state.heartsLost + (hurt ? 1 : 0),
      invulnerable: hurt ? invulnerableTicks : state.invulnerable,
    },
    hurt ? "bumped" : "shrugged",
  );
}

// One guard's tick: dizzy guards wait; the others step when it is their time, toward the cage with an egg, or the nearest loose egg,
// or Glitchy (outdoors) when none is loose.
function guardTick(
  state: CastleState,
  at: number,
  open: (x: number, y: number) => boolean,
): CastleState {
  const guard = state.guards[at];
  if (guard === undefined) return state;
  const set = (next: NightGuard): readonly NightGuard[] =>
    state.guards.map((other, index) => (index === at ? next : other));
  if (guard.dizzy > 0)
    return { ...state, guards: set({ ...guard, dizzy: guard.dizzy - 1 }) };
  if (state.tick - guard.moved < guardStep) return state;
  const loose = state.eggs.some((egg) => egg.state === "loose");
  const glitchy = (x: number, y: number) =>
    state.room < 0 && x === state.x && y === state.y;
  const target =
    guard.carrying >= 0
      ? (x: number, y: number) => x === cage.x && y === cage.y
      : loose
        ? (x: number, y: number) =>
            state.eggs.some(
              (egg) => egg.state === "loose" && egg.x === x && egg.y === y,
            )
        : glitchy;
  const passable = (x: number, y: number) =>
    open(x, y) &&
    !glitchy(x, y) &&
    !state.guards.some((other) => other.x === x && other.y === y);
  const step = stepToward(guard, target, passable);
  const moved = { ...guard, moved: state.tick };
  if (step === null) return { ...state, guards: set(moved) };
  if (glitchy(step.x, step.y))
    return bumped({ ...state, guards: set(moved) }, at);
  if (step.x === cage.x && step.y === cage.y)
    return {
      ...state,
      eggs: state.eggs.map((egg, index) =>
        index === guard.carrying ? { ...egg, state: "caged" } : egg,
      ),
      guards: set({ ...moved, carrying: -1 }),
    };
  const there = state.eggs.findIndex(
    (egg) => egg.state === "loose" && egg.x === step.x && egg.y === step.y,
  );
  const carrying = guard.carrying < 0 ? there : guard.carrying;
  return {
    ...state,
    eggs: state.eggs.map((egg, index) =>
      index === carrying ? { state: "carried", x: step.x, y: step.y } : egg,
    ),
    guards: set({ ...moved, carrying, x: step.x, y: step.y }),
  };
}

export function guardsTick(
  state: CastleState,
  open: (x: number, y: number) => boolean,
): CastleState {
  let next = state;
  for (let at = 0; at < state.guards.length; at += 1)
    next = guardTick(next, at, open);
  return next;
}

// A puff of fire along the way Glitchy faces (one tile, three in the ember helm, stopped by what cannot be walked through): every guard
// it reaches is dizzy and drops its egg.
export function scare(
  state: CastleState,
  way: Spot,
  open: (x: number, y: number) => boolean,
): CastleState {
  const reach = state.gear[2] === true ? helmReach : fireReach;
  let next = state;
  for (let far = 1; far <= reach; far += 1) {
    const x = state.x + way.x * far;
    const y = state.y + way.y * far;
    const hit = next.guards.findIndex(
      (guard) => guard.x === x && guard.y === y,
    );
    const guard = next.guards[hit];
    if (guard !== undefined) {
      next = say(
        {
          ...next,
          eggs: dropped(next.eggs, guard),
          guards: next.guards.map((other, index) =>
            index === hit
              ? { ...other, carrying: -1, dizzy: dizzyTicks }
              : other,
          ),
          stuns: next.stuns + 1,
        },
        "stunned",
      );
      continue;
    }
    if (!open(x, y)) break;
  }
  return next;
}

// Arriving on a tile at night: a loose egg is saved, and the forcefield bubble is taken.
export function gather(state: CastleState): CastleState {
  const egg = state.eggs.findIndex(
    (one) => one.state === "loose" && one.x === state.x && one.y === state.y,
  );
  const saved =
    egg < 0
      ? state
      : say(
          {
            ...state,
            eggs: state.eggs.map((one, at) =>
              at === egg ? { ...one, state: "saved" } : one,
            ),
          },
          "egg-saved",
        );
  return !saved.forceTaken && saved.x === bubble.x && saved.y === bubble.y
    ? say({ ...saved, forceTaken: true, forcefield: forceTicks }, "forcefield")
    : saved;
}

// Opening the cage saves every egg in it.
export const openCage = (state: CastleState): CastleState =>
  state.eggs.some((egg) => egg.state === "caged")
    ? say(
        {
          ...state,
          eggs: state.eggs.map((egg) =>
            egg.state === "caged" ? { ...egg, state: "saved" } : egg,
          ),
        },
        "cage-opened",
      )
    : say(state, "cage-empty");
