import { maxHearts } from "../constants.ts";
import { ahead } from "../grid.ts";
import { baseTile, cages, chests, panels } from "./base-map.ts";
import { ground, strike, withBase } from "./base.ts";
import { blazeTiles, eggRange, fireEvery, launchEvery } from "./constants.ts";
import { playScene } from "./scenes.ts";
import type { Base, WoodsState } from "./types.ts";

// What fire and the action key do out of the maze. Fire works at any height; the action key only on the ground, where Glitchy can reach
// a cage, a chest or a panel (or set the egg launcher down to launch an egg).
const at = (
  list: readonly { readonly x: number; readonly y: number }[],
  x: number,
  y: number,
): number => list.findIndex((spot) => spot.x === x && spot.y === y);

// A puff of fire reaches the tile ahead (three tiles in a berry's blaze, stopped by a tree or a wall) and strikes the first thing there.
export function breathe(state: WoodsState, base: Base): WoodsState {
  if (state.tick - base.fireTick < fireEvery) return state;
  const way = ahead[base.facing];
  const fired = { ...base, fireTick: state.tick };
  const breathed = {
    ...state,
    breaths: state.breaths + 1,
    breathTick: state.tick,
  };
  const reach = state.powers.blaze > 0 ? blazeTiles : 1;
  for (let far = 1; far <= reach; far += 1) {
    const x = base.x + way.x * far;
    const y = base.y + way.y * far;
    const hit = strike(fired, x, y);
    if (hit !== null) return withBase(breathed, hit);
    if (!ground(fired, x, y) && baseTile(x, y) !== "~") break;
  }
  return withBase(breathed, fired);
}

// The action key: free the dragon in a cage, open a chest for its rocket key, fit a key into a panel of the rocket (all three defuse
// it, once the factory is down and DeFu's shield with it); with nothing to use ahead, launch an egg.
export function use(state: WoodsState, base: Base): WoodsState {
  if (base.altitude > 0) return state;
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
