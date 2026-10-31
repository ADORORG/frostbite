import type { RunInput } from "@ador/game-sdk/run-record";

import { moves, showsOf } from "../../src/rules/castle/battle.ts";
import { maxTicks } from "../../src/rules/castle/constants.ts";
import { castleRules } from "../../src/rules/castle/index.ts";
import { boulders, brambles, items } from "../../src/rules/castle/places.ts";
import { startCastle, tickCastle } from "../../src/rules/castle/tick.ts";
import type {
  CastleControl,
  CastleState,
  Facing,
  Spot,
} from "../../src/rules/castle/types.ts";
import { ahead, walkable } from "../../src/rules/castle/world.ts";

// A player who knows the quest, for the guild's chapter: it walks (by a breadth-first search over the tiles it can walk) to each step of
// the quest in order, faces what it needs and talks, pushes, breathes or picks it up, and in a cheer challenge puts on the keeper's
// favourite show first and then the strongest show that is not tired. It stands for a player who reads every hint; the inputs it makes
// are a legal run to replay.
export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: CastleState;
}

interface Task {
  readonly done: (state: CastleState) => boolean;
  readonly face: Facing;
  readonly press: "act" | "fire" | null;
  readonly stand: Spot;
}

const fetch = (item: number): Task => ({
  done: (s) => s.taken[item] === true,
  face: "down",
  press: null,
  stand: items[item] ?? { x: 0, y: 0 },
});
const meet = (
  stand: Spot,
  face: Facing,
  done: (s: CastleState) => boolean,
  press: "act" | "fire" = "act",
): Task => ({
  done,
  face,
  press,
  stand,
});

export const quest = (skipSpark = false): readonly Task[] => [
  fetch(0),
  meet({ x: 22, y: 25 }, "up", (s) => s.friends[0] === true),
  meet({ x: 23, y: 25 }, "up", (s) => s.pushed[0] === true),
  meet({ x: 30, y: 25 }, "right", (s) => s.pushed[1] === true),
  fetch(1),
  meet({ x: 24, y: 23 }, "up", (s) => s.friends[1] === true),
  meet({ x: 23, y: 22 }, "up", (s) => s.lilies),
  meet({ x: 9, y: 17 }, "left", (s) => s.melted, "fire"),
  fetch(2),
  meet({ x: 21, y: 17 }, "up", (s) => s.friends[2] === true),
  meet({ x: 19, y: 15 }, "up", (s) => s.opened[0] === true),
  ...(skipSpark
    ? []
    : [
        meet({ x: 4, y: 12 }, "left", (s) => s.opened[1] === true),
        fetch(3),
        meet({ x: 34, y: 12 }, "right", (s) => s.friends[3] === true),
      ]),
  meet({ x: 19, y: 11 }, "up", (s) => s.cheered[0] === true),
  meet({ x: 19, y: 8 }, "up", (s) => s.cheered[1] === true),
  meet({ x: 19, y: 5 }, "up", (s) => s.cheered[2] === true),
  meet({ x: 19, y: 4 }, "up", (s) => s.cheered[3] === true),
  {
    done: (s) => s.bannerRaised,
    face: "up",
    press: null,
    stand: { x: 19, y: 2 },
  },
];

const ways: readonly Facing[] = ["up", "down", "left", "right"];

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

export function playCastle(
  seed: number,
  options: { readonly skipSpark?: boolean; readonly worstShow?: boolean } = {},
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
  const tasks = quest(options.skipSpark ?? false);
  while (state.tick < maxTicks && !state.bannerRaised) {
    const { battle } = state;
    if (battle !== null) {
      for (const way of ways) set(way, false);
      if (battle.phase === "choose") {
        const shows = showsOf(state);
        const wanted =
          options.worstShow === true
            ? (shows.find((m) => m !== battle.last) ?? 0)
            : bestShow(state);
        if (shows[battle.choice] !== wanted) tap("right");
        else tap("act");
      }
    } else if (state.step === null) {
      const task = tasks.find((t) => !t.done(state));
      if (task === undefined) break;
      if (state.x !== task.stand.x || state.y !== task.stand.y) {
        const way = firstStep(state, task.stand);
        for (const other of ways) if (other !== way) set(other, false);
        if (way !== null) set(way, true);
      } else {
        for (const way of ways) set(way, false);
        if (state.facing !== task.face) tap(task.face);
        else if (task.press !== null && !task.done(state)) tap(task.press);
      }
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
