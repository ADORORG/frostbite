import { stepToward, type Spot } from "../grid.ts";
import { ground, hurt, strike, withBase } from "./base.ts";
import {
  baseHeight,
  baseTile,
  baseWidth,
  guardRoutes,
  hatchery,
  lairRow,
} from "./base-map.ts";
import {
  eggSpeed,
  guardSight,
  guardStep,
  hatchEvery,
  hatchFirst,
  mostShadows,
  shadowStep,
} from "./constants.ts";
import type { Base, BaseGuard, Shadow, WoodsState } from "./types.ts";

// Who moves outside the maze besides Glitchy: the guards of the woods walk their routes and chase Glitchy when it comes near; DeFu's
// factory hatches shadow dragons that always chase (they fly, so Glitchy flying low is no safer from them); a launched egg flies on.
// Whoever steps into Glitchy bumps it (and a guard that does is dizzy a while after); a guard cannot reach Glitchy in the air.
const nearGlitchy = (base: Base, spot: Spot): number =>
  Math.abs(spot.x - base.x) + Math.abs(spot.y - base.y);

function chase(
  base: Base,
  from: Spot,
  target: (x: number, y: number) => boolean,
  inLair: boolean,
): Spot | null {
  return stepToward(baseWidth, baseHeight, from, target, (x, y) => {
    if (inLair ? y > lairRow : y <= lairRow) return false;
    if (!ground(base, x, y)) return false;
    if (x === base.x && y === base.y) return false;
    return (
      !base.guards.some((one) => one.x === x && one.y === y) &&
      !base.shadows.some((one) => one.x === x && one.y === y)
    );
  });
}

function guardStepOf(base: Base, guard: BaseGuard): BaseGuard | "bump" {
  const route = guardRoutes[guard.route];
  const end = route?.[guard.toward] ?? guard;
  const seen =
    base.altitude === 0 &&
    base.y > lairRow &&
    nearGlitchy(base, guard) <= guardSight;
  const target = seen
    ? (x: number, y: number) => x === base.x && y === base.y
    : (x: number, y: number) => x === end.x && y === end.y;
  const next = chase(base, guard, target, false);
  if (next === null) return guard;
  if (next.x === base.x && next.y === base.y) return "bump";
  const arrived = next.x === end.x && next.y === end.y;
  return {
    ...guard,
    toward: arrived ? (guard.toward === 0 ? 1 : 0) : guard.toward,
    x: next.x,
    y: next.y,
  };
}

export function guardsMove(state: WoodsState, base: Base): WoodsState {
  let next = base;
  let bumped = false;
  next = {
    ...next,
    guards: next.guards.map((guard) => {
      if (guard.dizzy > 0) return { ...guard, dizzy: guard.dizzy - 1 };
      if (state.tick - guard.moved < guardStep) return guard;
      const stepped = guardStepOf(next, guard);
      if (stepped === "bump") {
        bumped = true;
        return { ...guard, dizzy: guardStep * 6, moved: state.tick };
      }
      return { ...stepped, moved: state.tick };
    }),
  };
  return bumped ? hurt(state, next) : withBase(state, next);
}

// The factory hatches a shadow dragon at its door `hatchFirst` ticks into the lair and every `hatchEvery` after, while fewer than
// `mostShadows` are about and a valve is still whole; each shadow dragon steps toward Glitchy every `shadowStep` ticks.
export function shadowsMove(state: WoodsState, base: Base): WoodsState {
  const since = state.tick - base.lairStart - hatchFirst;
  const hatching =
    since >= 0 &&
    since % hatchEvery === 0 &&
    base.shadows.length < mostShadows &&
    !base.broken.every(Boolean) &&
    !(base.x === hatchery.x && base.y === hatchery.y);
  let next: Base = hatching
    ? {
        ...base,
        hatched: base.hatched + 1,
        shadows: [...base.shadows, { moved: state.tick, ...hatchery }],
      }
    : base;
  let bumped = false;
  next = {
    ...next,
    shadows: next.shadows.map((shadow): Shadow => {
      if (state.tick - shadow.moved < shadowStep) return shadow;
      const step = chase(
        next,
        shadow,
        (x, y) => x === base.x && y === base.y,
        true,
      );
      if (step === null) return { ...shadow, moved: state.tick };
      if (step.x === base.x && step.y === base.y) {
        bumped = true;
        return { ...shadow, moved: state.tick + shadowStep * 4 };
      }
      return { moved: state.tick, x: step.x, y: step.y };
    }),
  };
  return bumped ? hurt(state, next) : withBase(state, next);
}

// A launched egg moves a tile every `eggSpeed` ticks until it hits someone (or a valve), meets what it cannot fly through, or has gone
// its range.
export function eggFlies(state: WoodsState, base: Base): WoodsState {
  const { flight } = base;
  if (flight === null || state.tick - flight.moved < eggSpeed)
    return withBase(state, base);
  const x = flight.x + flight.dx;
  const y = flight.y + flight.dy;
  const hit = strike(base, x, y);
  if (hit !== null) return withBase(state, { ...hit, flight: null });
  const flying =
    flight.left > 1 && (ground(base, x, y) || baseTile(x, y) === "~");
  return withBase(state, {
    ...base,
    flight: flying
      ? { ...flight, left: flight.left - 1, moved: state.tick, x, y }
      : null,
  });
}
