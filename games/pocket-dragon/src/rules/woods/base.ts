import { maxHearts } from "../constants.ts";
import { ahead, type Facing, type Spot } from "../grid.ts";
import {
  arrival,
  baseTile,
  bubbleSpot,
  cages,
  chests,
  guardRoutes,
  heartSpot,
  lairGate,
  panels,
  valves,
} from "./base-map.ts";
import {
  baseStep,
  dizzyTicks,
  eggRange,
  fireEvery,
  forceTicks,
  invulnerableTicks,
  launchEvery,
} from "./constants.ts";
import { playScene, sceneTicks } from "./scenes.ts";
import type { Base, BaseGuard, WoodsState } from "./types.ts";

// Outside the maze, as the rules see it: where Glitchy can step, what the action key and fire do, being bumped, and the pickups. The
// guards, the shadow dragons and DeFu's weapons are in `foes.ts` and `lair.ts`.
const at = (list: readonly Spot[], x: number, y: number): number =>
  list.findIndex((spot) => spot.x === x && spot.y === y);

export function startBase(state: WoodsState): Base {
  return {
    allies: cages.map(() => false),
    ammo: state.eggs.filter(Boolean).length,
    broken: valves.map(() => false),
    bubbleTaken: false,
    cheered: 0,
    facing: "up",
    fireTick: -fireEvery,
    flight: null,
    forcefield: 0,
    freed: 0,
    guards: guardRoutes.map(([from], route) => ({
      dizzy: 0,
      moved: state.tick + route * 4,
      route,
      toward: 1,
      x: from.x,
      y: from.y,
    })),
    hatched: 0,
    heartTaken: false,
    installed: panels.map(() => false),
    invulnerable: 0,
    lairStart: -1,
    laser: null,
    launchTick: -launchEvery,
    pieces: chests.map(() => false),
    shadows: [],
    step: null,
    trail: [],
    x: arrival.x,
    y: arrival.y,
  };
}

// The ground as it is: the gate into the lair opens once the three rocket keys are found.
export function ground(base: Base, x: number, y: number): boolean {
  switch (baseTile(x, y)) {
    case ".":
    case ",":
    case "f":
    case "d":
    case "B":
    case "H":
      return true;
    case "G":
      return base.pieces.every(Boolean);
    default:
      return false;
  }
}

const someoneAt = (base: Base, x: number, y: number): boolean =>
  base.guards.some((one) => one.x === x && one.y === y) ||
  base.shadows.some((one) => one.x === x && one.y === y);

export const walkable = (base: Base, x: number, y: number): boolean =>
  ground(base, x, y) && !someoneAt(base, x, y);

export const withBase = (state: WoodsState, base: Base): WoodsState => ({
  ...state,
  base,
});

// A bump: a heart, unless Glitchy is blinking or has the forcefield. Out of hearts, the rocket launches.
export function hurt(state: WoodsState, base: Base): WoodsState {
  if (base.invulnerable > 0 || base.forcefield > 0)
    return withBase(state, base);
  const hearts = state.hearts - 1;
  const bumped = {
    ...state,
    base: { ...base, invulnerable: invulnerableTicks },
    hearts,
    heartsLost: state.heartsLost + 1,
  };
  return hearts > 0
    ? bumped
    : playScene({ ...bumped, outcome: "launched" }, "launch");
}

// A guard hit (by fire or an egg) is dizzy; one hit again while dizzy cheers up and goes home.
export function hitGuard(base: Base, index: number): Base {
  const guard = base.guards[index];
  if (guard === undefined) return base;
  return guard.dizzy > 0
    ? {
        ...base,
        cheered: base.cheered + 1,
        guards: base.guards.filter((_, other) => other !== index),
      }
    : {
        ...base,
        guards: base.guards.map((one, other): BaseGuard =>
          other === index ? { ...one, dizzy: dizzyTicks } : one,
        ),
      };
}

// What the fire or an egg does on reaching a tile: a guard is hit, a shadow dragon is set free, a valve of the factory breaks.
export function strike(base: Base, x: number, y: number): Base | null {
  const guard = base.guards.findIndex((one) => one.x === x && one.y === y);
  if (guard >= 0) return hitGuard(base, guard);
  const shadow = base.shadows.findIndex((one) => one.x === x && one.y === y);
  if (shadow >= 0)
    return {
      ...base,
      freed: base.freed + 1,
      shadows: base.shadows.filter((_, other) => other !== shadow),
    };
  const valve = at(valves, x, y);
  if (valve >= 0 && base.broken[valve] !== true)
    return {
      ...base,
      broken: base.broken.map((done, other) => done || other === valve),
    };
  return null;
}

export function breathe(state: WoodsState, base: Base): WoodsState {
  if (state.tick - base.fireTick < fireEvery) return state;
  const way = ahead[base.facing];
  const fired = { ...base, fireTick: state.tick };
  return withBase(
    { ...state, breaths: state.breaths + 1, breathTick: state.tick },
    strike(fired, base.x + way.x, base.y + way.y) ?? fired,
  );
}

// The action key: free the dragon in a cage, open a chest for its rocket key, fit a key into a panel of the rocket (all three defuse
// it, once the factory is down and DeFu's shield with it); with nothing to use ahead, launch an egg.
export function use(state: WoodsState, base: Base): WoodsState {
  const way = ahead[base.facing];
  const x = base.x + way.x;
  const y = base.y + way.y;
  const cage = at(cages, x, y);
  if (cage >= 0 && base.allies[cage] !== true)
    return withBase(
      { ...state, hearts: Math.min(maxHearts, state.hearts + 1) },
      { ...base, allies: base.allies.map((done, i) => done || i === cage) },
    );
  const chest = at(chests, x, y);
  if (chest >= 0)
    return withBase(state, {
      ...base,
      pieces: base.pieces.map((done, i) => done || i === chest),
    });
  const panel = at(panels, x, y);
  if (panel >= 0 && base.installed[panel] !== true) {
    if (!base.broken.every(Boolean))
      return { ...state, found: { kind: "shielded", tick: state.tick } };
    const installed = base.installed.map((done, i) => done || i === panel);
    const fitted = withBase(state, { ...base, installed });
    return installed.every(Boolean)
      ? playScene(
          { ...fitted, finishTick: state.tick, outcome: "defused" },
          "peace",
        )
      : fitted;
  }
  if (base.ammo <= 0 || state.tick - base.launchTick < launchEvery)
    return state;
  return withBase(state, {
    ...base,
    ammo: base.ammo - 1,
    flight: {
      dx: way.x,
      dy: way.y,
      left: eggRange,
      moved: state.tick,
      x: base.x,
      y: base.y,
    },
    launchTick: state.tick,
  });
}

// A way pressed turns Glitchy to it (walking is the tick's business, while the way is held).
export const turn = (base: Base, way: Facing): Base => ({
  ...base,
  facing: way,
});

// Arriving on a tile: the forcefield bubble and the heart are taken, and stepping through the lair's gate plays DeFu's scene; the lair
// begins (its countdown and DeFu's weapons) once the scene is over or skipped.
export function arrive(state: WoodsState, base: Base): WoodsState {
  const { x, y } = base;
  let next = base;
  let hearts = state.hearts;
  if (!next.bubbleTaken && x === bubbleSpot.x && y === bubbleSpot.y)
    next = { ...next, bubbleTaken: true, forcefield: forceTicks };
  if (!next.heartTaken && x === heartSpot.x && y === heartSpot.y) {
    next = { ...next, heartTaken: true };
    hearts = Math.min(maxHearts, hearts + 1);
  }
  const arrived = withBase({ ...state, hearts }, next);
  if (next.lairStart >= 0 || x !== lairGate.x || y !== lairGate.y)
    return arrived;
  const lairStart = state.tick + sceneTicks.lair;
  return playScene(withBase(arrived, { ...next, lairStart }), "lair");
}

// Glitchy's steps: a way held begins one (only turning Glitchy when that way is closed). A step takes `baseStep` ticks, and with a way
// still held the next begins on the tick it ends.
function stepOn(state: WoodsState, base: Base): WoodsState {
  const held = state.controls;
  const way = held[base.facing]
    ? base.facing
    : (["up", "down", "left", "right"] as const).find((one) => held[one]);
  if (way === undefined) return withBase(state, base);
  const step = ahead[way];
  if (!walkable(base, base.x + step.x, base.y + step.y))
    return withBase(state, turn(base, way));
  return withBase(state, {
    ...base,
    facing: way,
    step: { from: { x: base.x, y: base.y }, start: state.tick },
    trail: [{ x: base.x, y: base.y }, ...base.trail].slice(0, cages.length),
    x: base.x + step.x,
    y: base.y + step.y,
  });
}

export function walk(state: WoodsState, base: Base): WoodsState {
  if (base.step === null) return stepOn(state, base);
  if (state.tick - base.step.start < baseStep) return withBase(state, base);
  const arrived = arrive(state, { ...base, step: null });
  return arrived.scene === null && arrived.base !== null
    ? stepOn(arrived, arrived.base)
    : arrived;
}
