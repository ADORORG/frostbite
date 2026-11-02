import type { RunInput } from "@ador/game-sdk/run-record";

import {
  evadeMove,
  heldCharm,
  menuOf,
  moves,
  showsOf,
} from "../../src/rules/castle/battle.ts";
import { fireEvery, maxTicks } from "../../src/rules/castle/constants.ts";
import { castleRules } from "../../src/rules/castle/index.ts";
import {
  boulders,
  brambles,
  cage,
  king,
} from "../../src/rules/castle/places.ts";
import { startCastle, tickCastle } from "../../src/rules/castle/tick.ts";
import type {
  CastleControl,
  CastleState,
  Facing,
  Spot,
} from "../../src/rules/castle/types.ts";
import { ahead, walkable } from "../../src/rules/castle/world.ts";
import { dayAndWinter } from "./castle-tasks.ts";

// A player who knows the level, for the guild's chapter: it walks (by a breadth-first search over the tiles it can walk) to each step of
// the day and the winter in order (`castle-tasks.ts`), faces what it needs and talks, pushes, breathes or picks it up; at night it opens
// the cage when eggs are in it, saves the nearest loose egg, and breathes fire at a guard in its way or carrying an egg; in a cheer
// challenge it puts on the keeper's favourite show first and then the strongest show that is not tired. It stands for a player who reads
// every hint; the inputs it makes are a legal run to replay.
export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: CastleState;
}

const ways: readonly Facing[] = ["up", "down", "left", "right"];
// The hotkey of each show, by its place in `moves`.
const showKeys = ["show1", "show2", "show3", "show4", "show5"] as const;

function firstStep(state: CastleState, goal: Spot): Facing | null {
  const key = (x: number, y: number): number => y * 64 + x;
  const back = new Map<number, Facing | null>([[key(state.x, state.y), null]]);
  const queue: Spot[] = [{ x: state.x, y: state.y }];
  for (let at = 0; at < queue.length; at += 1) {
    const here = queue[at] ?? { x: 0, y: 0 };
    if (here.x === goal.x && here.y === goal.y)
      return back.get(key(here.x, here.y)) ?? null;
    for (const way of ways) {
      const next = { x: here.x + ahead[way].x, y: here.y + ahead[way].y };
      if (back.has(key(next.x, next.y)) || !walkable(state, next.x, next.y))
        continue;
      back.set(key(next.x, next.y), back.get(key(here.x, here.y)) ?? way);
      queue.push(next);
    }
  }
  return null;
}

// The show to put on: the favourite if the guild has it and it is not tired, else the strongest that is not tired.
export function bestShow(state: CastleState): number {
  const battle = state.battle;
  const shows = showsOf(state).filter((move) => move !== battle?.last);
  const favourite = battle === null ? -1 : (state.favourites[battle.foe] ?? -1);
  if (shows.includes(favourite)) return favourite;
  return shows.reduce(
    (best, move) =>
      (moves[move]?.power ?? 0) > (moves[best]?.power ?? 0) ? move : best,
    shows[0] ?? 0,
  );
}

interface Goal {
  readonly face: Facing;
  readonly press: "act" | "fire" | null;
  readonly stand: Spot;
}

const facingTo = (from: Spot, to: Spot): Facing =>
  to.x > from.x
    ? "right"
    : to.x < from.x
      ? "left"
      : to.y > from.y
        ? "down"
        : "up";

// At night: a guard next to Glitchy gets a puff of fire; the cage is opened when eggs are in it; the nearest loose egg is saved; and
// when every egg left is carried, the nearest guard carrying one is gone after.
function nightGoal(state: CastleState): Goal | null {
  const here = { x: state.x, y: state.y };
  const ready = state.fireTick < 0 || state.tick - state.fireTick >= fireEvery;
  const next = state.guards.find(
    (guard) => Math.abs(guard.x - state.x) + Math.abs(guard.y - state.y) === 1,
  );
  if (next !== undefined && ready && next.dizzy === 0)
    return { face: facingTo(here, next), press: "fire", stand: here };
  if (state.eggs.some((egg) => egg.state === "caged"))
    return { face: "up", press: "act", stand: { x: cage.x, y: cage.y + 1 } };
  const near = (spots: readonly Spot[]): Spot | undefined =>
    [...spots].sort(
      (a, b) =>
        Math.abs(a.x - here.x) +
        Math.abs(a.y - here.y) -
        (Math.abs(b.x - here.x) + Math.abs(b.y - here.y)),
    )[0];
  const loose = near(state.eggs.filter((egg) => egg.state === "loose"));
  if (loose !== undefined) return { face: "down", press: null, stand: loose };
  const thief = near(state.guards.filter((guard) => guard.carrying >= 0));
  if (thief === undefined) return null;
  const beside = ways
    .map((way) => ({ x: thief.x - ahead[way].x, y: thief.y - ahead[way].y }))
    .filter((spot) => walkable(state, spot.x, spot.y));
  const stand = near(beside);
  return stand === undefined
    ? null
    : { face: facingTo(stand, thief), press: "fire", stand };
}

export function playCastle(
  seed: number,
  options: { readonly worstShow?: boolean } = {},
): Played {
  let state = startCastle(seed);
  const inputs: RunInput[] = [];
  const set = (control: CastleControl, on: boolean): void => {
    if (state.controls[control] === on) return;
    const data = { on: on ? 1 : 0, tick: state.tick };
    const stepped = castleRules.step(state, { data, type: control });
    if (!stepped.ok) throw new Error(stepped.reason);
    state = stepped.state;
    inputs.push({ data, type: control });
  };
  const tap = (control: CastleControl): void => {
    set(control, true);
    set(control, false);
  };
  const tasks = dayAndWinter(options.worstShow !== true);
  // Walks one step toward a place to stand (letting go of the other ways); once there, faces the way and presses the key.
  const go = (goal: Goal): void => {
    if (state.x !== goal.stand.x || state.y !== goal.stand.y) {
      const way = firstStep(state, goal.stand);
      for (const other of ways) if (other !== way) set(other, false);
      if (way !== null) set(way, true);
      return;
    }
    for (const way of ways) set(way, false);
    if (state.facing !== goal.face) tap(goal.face);
    else if (goal.press !== null) tap(goal.press);
  };
  while (state.tick < maxTicks && !state.goldenEgg) {
    const { battle } = state;
    if (battle !== null) {
      for (const way of ways) set(way, false);
      if (battle.phase === "choose" && options.worstShow === true) {
        const menu = menuOf(state);
        const wanted = menu.find((m) => m !== battle.last) ?? 0;
        if (menu[battle.choice] !== wanted) tap("right");
        else tap("act");
      } else if (battle.phase === "choose") {
        const opened = battle.firstFavourite !== null;
        // The spirit charm when spirit runs low; the star and the shield for the king.
        const charm = heldCharm(state);
        const useful =
          charm === 0 ? battle.spirit <= 5 : charm > 0 && battle.foe === king;
        if (opened && useful) tap("charm");
        else if (opened && state.evades === 0 && battle.last !== evadeMove)
          tap("evade");
        else tap(showKeys[bestShow(state)] ?? "show1");
      }
    } else if (state.step === null && state.phase === "night") {
      const goal = nightGoal(state);
      if (goal === null) for (const way of ways) set(way, false);
      else go(goal);
    } else if (state.step === null) {
      const task = tasks.find((t) => !t.done(state));
      if (task === undefined) break;
      go({ ...task, press: task.done(state) ? null : task.press });
    }
    state = tickCastle(state);
  }
  const data = { tick: state.tick };
  const closed = castleRules.step(state, { data, type: "end" });
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, { data, type: "end" }], state: closed.state };
}

export const boulderSpots = boulders;
export const brambleSpots = brambles;
