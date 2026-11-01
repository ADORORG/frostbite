import {
  accel,
  featherBoost,
  gustTicks,
  jumpSpeed,
  levelTiles,
  rainAccel,
  tile,
  windPush,
} from "./constants.ts";
import type { Feel } from "./hero.ts";
import type { HillsState } from "./types.ts";

// The wind's push this tick: a gust blows for `gustTicks` and then it is calm as long; most gusts blow against Glitchy (to the left).
export function windOf(state: HillsState): number {
  if (state.level.weather !== "wind") return 0;
  const gust = Math.floor(state.tick / gustTicks);
  if (gust % 2 !== 0) return 0;
  return (Math.floor(gust / 2) + state.seed) % 3 === 0 ? windPush : -windPush;
}

// The weather and the charms, as Glitchy feels them this tick: rain makes the grass slippery, the feather charm makes jumps stronger.
// The weather is only out on the stage itself: the tunnel and the sky are calm.
export function feelOf(state: HillsState): Feel {
  const out = state.hero.x < levelTiles * tile;
  return {
    accel: out && state.level.weather === "rain" ? rainAccel : accel,
    jump: jumpSpeed + (state.feather ? featherBoost : 0),
    push: out ? windOf(state) : 0,
  };
}
