import type { RunInput } from "@ador/game-sdk/run-record";

import {
  cell,
  clueCount,
  frozen,
  gate,
  maxTicks,
  open,
  size,
} from "../../src/rules/woods/constants.ts";
import { startWoods, woodsRules } from "../../src/rules/woods/index.ts";
import { indexOf } from "../../src/rules/woods/maze.ts";
import { cluesRead, tickWoods } from "../../src/rules/woods/tick.ts";
import { fullTurn } from "../../src/rules/woods/trig.ts";
import type {
  Place,
  WoodsControl,
  WoodsState,
} from "../../src/rules/woods/types.ts";
import { cellAt } from "../../src/rules/woods/walk.ts";

// A player who knows the woods, for the Whispering Woods: it walks the paths (found by a breadth-first search over the cells) to
// whatever is nearest of what is left (clue stones and chests, the lanterns and the frozen hedge, which it faces and breathes fire at,
// then the moon chest), and last to the moon gate. It stands for a careful player who maps as they go; the inputs it makes are a legal
// run to replay.
export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: WoodsState;
}

export interface WoodsPlan {
  // Leave out the lanterns, the moon chest and the chests, and go straight for the clues and the gate.
  readonly hurry?: boolean;
  readonly limit?: number;
}

const passable = (state: WoodsState, index: number): boolean => {
  const wall = state.level.walls[index];
  return (
    wall === open ||
    (wall === frozen && state.melted) ||
    (wall === gate && cluesRead(state) >= clueCount)
  );
};

function route(
  state: WoodsState,
  from: number,
  goals: ReadonlySet<number>,
): readonly number[] | null {
  const back = new Map<number, number>([[from, -1]]);
  const queue = [from];
  for (let at = 0; at < queue.length; at += 1) {
    const here = queue[at] ?? 0;
    if (goals.has(here)) {
      const path: number[] = [];
      for (let step = here; step !== -1; step = back.get(step) ?? -1)
        path.unshift(step);
      return path;
    }
    for (const next of [here + 1, here - 1, here + size, here - size])
      if (!back.has(next) && passable(state, next)) {
        back.set(next, here);
        queue.push(next);
      }
  }
  return null;
}

const centreOf = (index: number): readonly [number, number] => [
  (index % size) * cell + cell / 2,
  Math.floor(index / size) * cell + cell / 2,
];
const placeIndex = (place: Place): number => indexOf(place.x, place.y);
const angleTo = (state: WoodsState, x: number, y: number): number =>
  ((Math.round(
    (Math.atan2(y - state.y, x - state.x) / (2 * Math.PI)) * fullTurn,
  ) %
    fullTurn) +
    fullTurn) %
  fullTurn;
const turnBy = (state: WoodsState, target: number): number =>
  ((target - state.angle + 1536) % fullTurn) - 512;

// Where to stand to breathe at a cell: a path cell next to it, or two away in a straight line with a path between.
function firingSpots(state: WoodsState, target: number): Set<number> {
  const spots = new Set<number>();
  for (const step of [1, -1, size, -size]) {
    if (passable(state, target + step)) spots.add(target + step);
    if (passable(state, target + step) && passable(state, target + 2 * step))
      spots.add(target + 2 * step);
  }
  return spots;
}

interface Goal {
  readonly aim: number | null;
  readonly cells: ReadonlySet<number>;
}

function nextGoal(state: WoodsState, hurry: boolean): Goal | null {
  const goals: Goal[] = [];
  const take = (places: readonly Place[], done: readonly boolean[]): void =>
    places.forEach((place, at) => {
      if (done[at] !== true)
        goals.push({ aim: null, cells: new Set([placeIndex(place)]) });
    });
  take(state.level.clues, state.clues);
  if (!hurry) {
    take(state.level.chests, state.chests);
    state.level.lanterns.forEach((place, at) => {
      if (state.lanterns[at] !== true)
        goals.push({
          aim: placeIndex(place),
          cells: firingSpots(state, placeIndex(place)),
        });
    });
    if (!state.melted)
      goals.push({
        aim: state.level.frozen,
        cells: firingSpots(state, state.level.frozen),
      });
    else if (!state.moonChest)
      goals.push({
        aim: null,
        cells: new Set([placeIndex(state.level.moonChest)]),
      });
  }
  if (goals.length === 0)
    return cluesRead(state) >= clueCount
      ? { aim: null, cells: new Set([state.level.gate]) }
      : null;
  const here = cellAt(state.x, state.y);
  let best: { goal: Goal; length: number } | null = null;
  for (const goal of goals) {
    const path = route(state, here, goal.cells);
    if (path !== null && (best === null || path.length < best.length))
      best = { goal, length: path.length };
  }
  return best?.goal ?? null;
}

export function walkWoods(seed: number, plan: WoodsPlan = {}): Played {
  const { hurry = false, limit = maxTicks } = plan;
  let state = startWoods(seed);
  const inputs: RunInput[] = [];
  const set = (control: WoodsControl, on: boolean): void => {
    if (state.controls[control] === on) return;
    const data = { on: on ? 1 : 0, tick: state.tick };
    const stepped = woodsRules.step(state, { data, type: control });
    if (!stepped.ok) throw new Error(stepped.reason);
    state = stepped.state;
    inputs.push({ data, type: control });
  };
  while (state.tick < limit && !state.escaped) {
    set("fire", false);
    const goal = nextGoal(state, hurry);
    const here = cellAt(state.x, state.y);
    const path = goal === null ? null : route(state, here, goal.cells);
    let target: readonly [number, number] | null = null;
    let fireNow = false;
    if (goal !== null && path !== null) {
      const [cx, cy] = centreOf(here);
      const settled =
        Math.abs(state.x - cx) < 48 && Math.abs(state.y - cy) < 48;
      if (path.length <= 1 && goal.aim !== null && settled) {
        target = centreOf(goal.aim);
        fireNow = true;
      } else target = centreOf(path[Math.min(1, path.length - 1)] ?? here);
    }
    if (target === null) {
      for (const control of ["left", "right", "up", "down"] as const)
        set(control, false);
    } else {
      const turn = turnBy(state, angleTo(state, target[0], target[1]));
      const close = Math.hypot(target[0] - state.x, target[1] - state.y) < 6;
      set("left", turn < -6);
      set("right", turn > 6);
      set("up", !fireNow && !close && Math.abs(turn) < 80);
      if (fireNow && Math.abs(turn) <= 6 && state.fireCooldown === 0)
        set("fire", true);
    }
    state = tickWoods(state);
  }
  const data = { tick: state.tick };
  const closed = woodsRules.step(state, { data, type: "end" });
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, { data, type: "end" }], state: closed.state };
}
