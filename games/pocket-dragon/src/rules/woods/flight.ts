import { baseTile, lairRow } from "./base-map.ts";
import type { Altitude, Base, WoodsState } from "./types.ts";

// Flying out of the maze. Glitchy climbs from the ground to flying low, and from flying low to soaring over the treetops; it dives back
// the same way. Flying low it crosses water and what is small (a chest, a cage, a valve, a panel) and anything on the ground, out of
// reach of the guards and under DeFu's shockwave, but not the tall things: trees, walls and torches, the factory, the rocket, pillars,
// DeFu's platform, and the lair's gate while it is shut. Soaring it crosses the trees too, but never DeFu's castle walls or its gate,
// and it cannot soar inside her castle, which has a roof. It can climb anywhere it may fly, and lands only on open ground where no one
// stands.
const tall = new Set(["T", "W", "t", "F", "R", "p", "P"]);
const walls = new Set(["W", "t"]);

const gateShut = (base: Base, tile: string): boolean =>
  tile === "G" && !base.pieces.every(Boolean);

export function passable(
  base: Base,
  x: number,
  y: number,
  altitude: Altitude,
): boolean {
  const tile = baseTile(x, y);
  if (gateShut(base, tile)) return false;
  if (altitude === 2) return y > lairRow && !walls.has(tile) && tile !== "G";
  return (
    !tall.has(tile) && !base.shadows.some((one) => one.x === x && one.y === y)
  );
}

// Whether a way up is open here, and a way down: the height after, or null.
export function climbed(base: Base): Altitude | null {
  if (base.altitude === 0) return 1;
  return base.altitude === 1 && passable(base, base.x, base.y, 2) ? 2 : null;
}

export function dived(
  base: Base,
  land: (x: number, y: number) => boolean,
): Altitude | null {
  if (base.altitude === 2) return passable(base, base.x, base.y, 1) ? 1 : null;
  return base.altitude === 1 && land(base.x, base.y) ? 0 : null;
}

// A press of climb or dive: up or down a height, or a word on the screen that there is no higher to go here (`ceiling`) or no room to come
// down (`grounded`). Diving on the ground does nothing.
export function fly(
  state: WoodsState,
  base: Base,
  up: boolean,
  land: (x: number, y: number) => boolean,
): WoodsState {
  const altitude = up ? climbed(base) : dived(base, land);
  if (altitude !== null) return { ...state, base: { ...base, altitude } };
  if (!up && base.altitude === 0) return state;
  return {
    ...state,
    found: { kind: up ? "ceiling" : "grounded", tick: state.tick },
  };
}
