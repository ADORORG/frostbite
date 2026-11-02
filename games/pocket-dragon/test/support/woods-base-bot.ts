import { ahead, type Facing, type Spot } from "../../src/rules/grid.ts";
import { ground } from "../../src/rules/woods/base.ts";
import {
  baseHeight,
  baseWidth,
  bubbleSpot,
  cages,
  chests,
  hallRows,
  heartSpot,
  lairGate,
  panels,
  valves,
} from "../../src/rules/woods/base-map.ts";
import {
  baseStep,
  fireEvery,
  waveReach,
} from "../../src/rules/woods/constants.ts";
import { woodsDone } from "../../src/rules/woods/index.ts";
import { fromDefu, laserPhase, waveAt } from "../../src/rules/woods/lair.ts";
import type {
  Base,
  WoodsControl,
  WoodsState,
} from "../../src/rules/woods/types.ts";

// A player who knows the woods outside the maze. In the woods it frees the caged dragons, takes the forcefield and the heart, opens the
// chests for the rocket keys and walks through the lair's gate; in the lair it breaks the factory's valves and fits the keys into the
// rocket. It breathes fire at any guard or shadow dragon next to it, steps off the line DeFu's laser glows on, and runs from her
// shockwave to the dungeon or far across the hall. It walks the shortest way, tile by tile, to whatever is nearest of what is left.
export interface Hands {
  readonly set: (control: WoodsControl, on: boolean) => void;
  readonly state: () => WoodsState;
  readonly tick: () => void;
}

export interface BasePlan {
  // Leave the cages, the forcefield and the heart, and go straight for the keys, the valves and the rocket.
  readonly hurry?: boolean;
  // Walk to the lair and then do nothing at all there, so the rocket launches.
  readonly idle?: boolean;
  readonly limit: number;
  // Let the scenes play out instead of skipping them.
  readonly watch?: boolean;
}

const ways: readonly Facing[] = ["up", "down", "left", "right"];
const key = (x: number, y: number): number => y * baseWidth + x;
const inHall = (spot: Spot): boolean => spot.y <= hallRows;

interface Goal {
  // Where to stand, and (for something to use or burn) which way to face there and what to press.
  readonly face: Facing | null;
  readonly press: "act" | "fire" | null;
  readonly spots: ReadonlyMap<number, Facing | null>;
}

const besides = (base: Base, target: Spot, press: "act" | "fire"): Goal => {
  const spots = new Map<number, Facing | null>();
  for (const way of ways) {
    const x = target.x - ahead[way].x;
    const y = target.y - ahead[way].y;
    if (ground(base, x, y)) spots.set(key(x, y), way);
  }
  return { face: null, press, spots };
};
const onto = (spot: Spot): Goal => ({
  face: null,
  press: null,
  spots: new Map([[key(spot.x, spot.y), null]]),
});

function goalsOf(base: Base, plan: BasePlan): readonly Goal[] {
  const goals: Goal[] = [];
  if (base.lairStart < 0) {
    if (plan.hurry !== true) {
      cages.forEach((cage, at) => {
        if (base.allies[at] !== true) goals.push(besides(base, cage, "act"));
      });
      if (!base.bubbleTaken) goals.push(onto(bubbleSpot));
      if (!base.heartTaken) goals.push(onto(heartSpot));
    }
    chests.forEach((chest, at) => {
      if (base.pieces[at] !== true) goals.push(besides(base, chest, "act"));
    });
    if (goals.length === 0) goals.push(onto(lairGate));
    return goals;
  }
  if (plan.idle === true) return [];
  valves.forEach((valve, at) => {
    if (base.broken[at] !== true) goals.push(besides(base, valve, "fire"));
  });
  if (goals.length === 0)
    panels.forEach((panel, at) => {
      if (base.installed[at] !== true) goals.push(besides(base, panel, "act"));
    });
  return goals;
}

// Tiles to keep off now: the line DeFu's laser glows or burns on, in the hall.
function danger(base: Base, tick: number): (x: number, y: number) => boolean {
  const { laser } = base;
  if (laserPhase(base, tick) === null || laser === null) return () => false;
  return (x, y) =>
    y <= hallRows && (laser.horizontal ? y === laser.line : x === laser.line);
}

// Safe from the shockwave going off now: out of the hall, out of its reach, or where it has already passed.
const sheltered = (spot: Spot, wave: number): boolean =>
  !inHall(spot) ||
  fromDefu(spot.x, spot.y) > waveReach ||
  (wave > 0 && fromDefu(spot.x, spot.y) < wave);

// The first way to go from Glitchy's tile to the nearest goal tile, and the goal tile reached (null when none can be reached).
function firstWay(
  base: Base,
  goals: ReadonlyMap<number, unknown>,
  avoid: (x: number, y: number) => boolean,
): { readonly way: Facing | null; readonly at: number } | null {
  const start = key(base.x, base.y);
  if (goals.has(start)) return { at: start, way: null };
  const first = new Map<number, Facing>();
  const queue = [start];
  const seen = new Set([start]);
  for (let at = 0; at < queue.length; at += 1) {
    const here = queue[at] ?? start;
    const x = here % baseWidth;
    const y = Math.floor(here / baseWidth);
    for (const way of ways) {
      const nx = x + ahead[way].x;
      const ny = y + ahead[way].y;
      const next = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= baseWidth || ny >= baseHeight) continue;
      if (seen.has(next) || !walkableNow(base, nx, ny) || avoid(nx, ny))
        continue;
      seen.add(next);
      const way0 = here === start ? way : (first.get(here) ?? way);
      first.set(next, way0);
      if (goals.has(next)) return { at: next, way: way0 };
      queue.push(next);
    }
  }
  return null;
}

const walkableNow = (base: Base, x: number, y: number): boolean =>
  ground(base, x, y) &&
  !base.guards.some((one) => one.x === x && one.y === y) &&
  !base.shadows.some((one) => one.x === x && one.y === y);

// A guard or shadow dragon right next to Glitchy, and the way to it.
function foeBeside(base: Base): Facing | null {
  for (const way of ways) {
    const x = base.x + ahead[way].x;
    const y = base.y + ahead[way].y;
    const guard = base.guards.find((one) => one.x === x && one.y === y);
    if (
      guard !== undefined ||
      base.shadows.some((one) => one.x === x && one.y === y)
    )
      return way;
  }
  return null;
}

interface Choice {
  readonly press: "act" | "fire" | null;
  readonly way: Facing | null;
}

function choose(state: WoodsState, base: Base, plan: BasePlan): Choice {
  if (plan.idle === true && base.lairStart >= 0)
    return { press: null, way: null };
  const foe = foeBeside(base);
  if (foe !== null)
    return base.facing === foe
      ? { press: "fire", way: null }
      : { press: null, way: foe };
  const avoid = danger(base, state.tick);
  const wave = waveAt(base, state.tick);
  if (wave !== null && !sheltered(base, wave)) {
    const safe = new Map<number, null>();
    for (let y = 0; y < baseHeight; y += 1)
      for (let x = 0; x < baseWidth; x += 1)
        if (ground(base, x, y) && sheltered({ x, y }, wave === 0 ? 1 : wave))
          safe.set(key(x, y), null);
    return { press: null, way: firstWay(base, safe, avoid)?.way ?? null };
  }
  if (avoid(base.x, base.y)) {
    const off = ways.find(
      (way) =>
        walkableNow(base, base.x + ahead[way].x, base.y + ahead[way].y) &&
        !avoid(base.x + ahead[way].x, base.y + ahead[way].y),
    );
    return { press: null, way: off ?? null };
  }
  const targets = new Map<
    number,
    { face: Facing | null; press: Goal["press"] }
  >();
  for (const goal of goalsOf(base, plan))
    for (const [at, face] of goal.spots)
      if (!targets.has(at)) targets.set(at, { face, press: goal.press });
  const found = firstWay(base, targets, avoid);
  if (found === null) return { press: null, way: null };
  if (found.way !== null) return { press: null, way: found.way };
  const here = targets.get(found.at);
  if (here?.face === null || here === undefined)
    return { press: null, way: null };
  return base.facing === here.face
    ? { press: here.press, way: null }
    : { press: null, way: here.face };
}

export function playBase(hands: Hands, plan: BasePlan): void {
  for (;;) {
    const state = hands.state();
    if (state.tick >= plan.limit || woodsDone(state)) return;
    hands.set("act", false);
    hands.set("fire", false);
    const { base } = state;
    if (state.scene !== null || base === null) {
      for (const way of ways) hands.set(way, false);
      if (state.scene !== null && plan.watch !== true) hands.set("act", true);
      hands.tick();
      continue;
    }
    // Glitchy goes on to the next tile on the tick a step ends, so the way to go next is chosen the tick before.
    const deciding =
      base.step === null || state.tick + 1 - base.step.start >= baseStep;
    const choice = deciding ? choose(state, base, plan) : null;
    if (choice !== null) {
      for (const way of ways) hands.set(way, way === choice.way);
      const ready =
        choice.press !== "fire" || state.tick - base.fireTick >= fireEvery;
      if (choice.press !== null && ready && base.step === null)
        hands.set(choice.press, true);
    }
    hands.tick();
  }
}
