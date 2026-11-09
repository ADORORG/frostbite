import { Vector3 } from "three";

import type { Box } from "../rules/geometry.ts";

// What keeps the camera out of things: the walls (seen from above, made a little thicker) and the ground, which rises on the hill.

// How far along a line from `from` to `to` (0 to 1) it first meets a wall, made a little thicker; 1 when it meets none.
export function clearance(
  from: Vector3,
  to: Vector3,
  walls: readonly Box[],
  pad = 0.3,
): number {
  let first = 1;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  for (const wall of walls) {
    const x0 = wall.x0 / 1000 - pad;
    const x1 = wall.x1 / 1000 + pad;
    const z0 = wall.z0 / 1000 - pad;
    const z1 = wall.z1 / 1000 + pad;
    let enter = 0;
    let leave = 1;
    for (const [start, step, low, high] of [
      [from.x, dx, x0, x1],
      [from.z, dz, z0, z1],
    ] as const) {
      if (Math.abs(step) < 1e-9) {
        if (start < low || start > high) leave = -1;
        continue;
      }
      const a = (low - start) / step;
      const b = (high - start) / step;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (enter <= leave && leave > 0 && enter > 0)
      first = Math.min(first, enter);
  }
  return first;
}

// How far to lift a camera at `at`, looking at `head`, so that it stands at least half a metre over the ground beneath it and its line
// to the head runs clear of the ground on the way (a camera behind someone walking down the hill would otherwise sink into it).
export function overGround(
  at: Vector3,
  head: Vector3,
  ground: (x: number, z: number) => number,
): number {
  let lift = ground(at.x, at.z) + 0.5 - at.y;
  const on = new Vector3();
  for (const along of [0.25, 0.5, 0.75]) {
    on.copy(at).lerp(head, along);
    lift = Math.max(lift, (ground(on.x, on.z) + 0.3 - on.y) / (1 - along));
  }
  return Math.max(0, lift);
}
