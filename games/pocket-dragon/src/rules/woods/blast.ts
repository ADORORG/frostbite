import { blastNext, blastRolled } from "../kit.ts";
import { baseTile, valves } from "./base-map.ts";
import { ground, withBase } from "./base.ts";
import type { Base, WoodsState } from "./types.ts";

// A glitch blast out of the maze rolls from Glitchy the way it faces, a tile at a time, and clears everything in its path: a guard goes
// straight home, a shadow dragon is set free, and a valve of the egg factory breaks (and stops it). It rolls over grass, paths, floors
// and water, and stops at a tree or a wall (or the lair's gate while it is shut).
function clearTile(base: Base, x: number, y: number): Base {
  const guards = base.guards.filter((one) => one.x !== x || one.y !== y);
  const shadows = base.shadows.filter((one) => one.x !== x || one.y !== y);
  const valve = valves.findIndex((one) => one.x === x && one.y === y);
  return {
    ...base,
    broken:
      valve < 0
        ? base.broken
        : base.broken.map((done, at) => done || at === valve),
    cheered: base.cheered + base.guards.length - guards.length,
    freed: base.freed + base.shadows.length - shadows.length,
    guards,
    shadows,
  };
}

export function rollBaseBlast(state: WoodsState, base: Base): WoodsState {
  const { blast } = base;
  if (blast === null) return withBase(state, base);
  const to = blastNext(blast, state.tick);
  if (to === null)
    return withBase(state, blast.left <= 0 ? { ...base, blast: null } : base);
  const cleared = clearTile(base, to.x, to.y);
  const rolls = ground(cleared, to.x, to.y) || baseTile(to.x, to.y) === "~";
  return withBase(state, {
    ...cleared,
    blast: rolls ? blastRolled(blast, to, state.tick) : null,
  });
}
