import { visionCooldown, visionCost, visionTicks } from "./constants.ts";
import type { Base, WoodsState } from "./types.ts";

// Frost vision, out of the maze only: a sense of what is coming. For `visionTicks` the world moves at half speed (the guards, the shadow
// dragons, DeFu's laser, shockwave and factory, and the rocket's countdown all wait every other tick) while Glitchy moves as fast as
// ever; the screen shows where three ways would lead. It costs `visionCost` metaplasma, and can be used again `visionCooldown` ticks
// after it ends. Without enough metaplasma, or while it cools down, a press only says so.
export const plasmaLeft = (state: WoodsState): number =>
  state.plasma.gathered - state.plasmaSpent;

export const visionOn = (base: Base, tick: number): boolean =>
  base.visionStart >= 0 && tick < base.visionUntil;

// Whether the world waits on this tick (every other tick of the vision).
export const worldWaits = (base: Base, tick: number): boolean =>
  visionOn(base, tick) && (tick - base.visionStart) % 2 === 1;

export function frostVision(state: WoodsState, base: Base): WoodsState {
  if (state.tick < base.visionReady || plasmaLeft(state) < visionCost)
    return { ...state, found: { kind: "weary", tick: state.tick } };
  return {
    ...state,
    base: {
      ...base,
      visionReady: state.tick + visionTicks + visionCooldown,
      visionStart: state.tick,
      visionUntil: state.tick + visionTicks,
    },
    found: { kind: "frost", tick: state.tick },
    plasmaSpent: state.plasmaSpent + visionCost,
  };
}

// A tick the world waits: every clock of DeFu's and her helpers is put back one, so that on the next tick it goes on from where it was.
export const holdWorld = (base: Base): Base => ({
  ...base,
  guards: base.guards.map((guard) => ({ ...guard, moved: guard.moved + 1 })),
  lairStart: base.lairStart < 0 ? base.lairStart : base.lairStart + 1,
  shadows: base.shadows.map((one) => ({ ...one, moved: one.moved + 1 })),
});
