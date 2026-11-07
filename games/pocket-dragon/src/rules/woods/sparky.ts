import { ahead, type Spot } from "../grid.ts";
import { packItem, type Item } from "../kit.ts";
import { baseTile } from "./base-map.ts";
import type { Base, WoodsState } from "./types.ts";

// Sparky: a tiny glowing atom who joins Glitchy out of the maze and helps. Sparky can zip into spaces too small for a dragon: the hollow
// of a tree, the gap behind a torch on the dungeon wall, a crack in a pillar of DeFu's hall. Each of those nooks hides something, and
// the help key sends Sparky to the first one up to three tiles ahead (Sparky slips past trees, water and machines, but not through
// DeFu's castle walls), to bring it back: a food for the backpack, three eggs for the launcher, or a burst of metaplasma. A trip there
// and back takes `sparkyTicks`; with no nook in reach, Sparky says so.
export type Treasure = Item | "eggs" | "plasma";
export interface Nook extends Spot {
  readonly treasure: Treasure;
}

export const nooks: readonly Nook[] = [
  { treasure: "mushroom", x: 9, y: 15 },
  { treasure: "plasma", x: 3, y: 16 },
  { treasure: "eggs", x: 22, y: 22 },
  { treasure: "pineapple", x: 6, y: 23 },
  { treasure: "berry", x: 8, y: 12 },
  { treasure: "plasma", x: 24, y: 2 },
];
export const sparkyReach = 3;
export const sparkyTicks = 40;
export const nookEggs = 3;
export const nookPlasma = 15;

const walls = new Set(["W", "t"]);

// The nook Sparky can reach from where Glitchy is, the way it faces: its place in `nooks`, or -1.
export function nookAhead(base: Base): number {
  const way = ahead[base.facing];
  for (let far = 1; far <= sparkyReach; far += 1) {
    const x = base.x + way.x * far;
    const y = base.y + way.y * far;
    const nook = nooks.findIndex((one) => one.x === x && one.y === y);
    if (nook >= 0 && base.nooksTaken[nook] !== true) return nook;
    if (walls.has(baseTile(x, y))) return -1;
  }
  return -1;
}

export function sendSparky(state: WoodsState, base: Base): WoodsState {
  if (base.trip !== null) return state;
  const nook = nookAhead(base);
  if (nook < 0) return { ...state, found: { kind: "empty", tick: state.tick } };
  return { ...state, base: { ...base, trip: { nook, start: state.tick } } };
}

// Sparky's trip, a tick on: back with the nook's treasure once it has taken `sparkyTicks`.
export function sparkyTick(state: WoodsState, base: Base): WoodsState {
  const { trip } = base;
  if (trip === null || state.tick - trip.start < sparkyTicks)
    return { ...state, base };
  const treasure = nooks[trip.nook]?.treasure ?? "plasma";
  const back: Base = {
    ...base,
    ammo: base.ammo + (treasure === "eggs" ? nookEggs : 0),
    nooksTaken: base.nooksTaken.map((done, at) => done || at === trip.nook),
    trip: null,
  };
  const found = { kind: "sparky" as const, tick: state.tick };
  if (treasure === "eggs") return { ...state, base: back, found };
  if (treasure === "plasma")
    return {
      ...state,
      base: back,
      found,
      plasma: {
        ...state.plasma,
        gathered: state.plasma.gathered + nookPlasma,
      },
    };
  return {
    ...state,
    base: back,
    found,
    powers: packItem(state.powers, treasure, state.tick),
  };
}
