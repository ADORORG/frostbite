import { Vector3 } from "three";

import type { Ring } from "./loft.ts";

// Shaping helpers for the lofted bodies: a smooth step, a smooth profile through keys, and rings along a chain of bones.
// A smooth step from 0 to 1 between two edges.
export const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Sampling a list of (position, value) keys smoothly: the width of a torso, say, at a height along it.
export function profile(
  keys: readonly (readonly [number, number])[],
  at: number,
): number {
  // A smooth curve through the keys that never overshoots them (monotone cubic), so a shape swells and narrows without ridges.
  const count = keys.length;
  const first = keys[0];
  const last = keys[count - 1];
  if (first === undefined || last === undefined) return 0;
  if (at <= first[0]) return first[1];
  if (at >= last[0]) return last[1];
  const x = (index: number) => keys[index]?.[0] ?? 0;
  const y = (index: number) => keys[index]?.[1] ?? 0;
  const slope = (index: number) =>
    (y(index + 1) - y(index)) / Math.max(1e-9, x(index + 1) - x(index));
  const tangent = (index: number): number => {
    if (index <= 0) return slope(0);
    if (index >= count - 1) return slope(count - 2);
    const before = slope(index - 1);
    const after = slope(index);
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  };
  let index = 0;
  while (index < count - 2 && at > x(index + 1)) index += 1;
  const h = x(index + 1) - x(index);
  const t = (at - x(index)) / Math.max(1e-9, h);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y(index) +
    (t3 - 2 * t2 + t) * h * tangent(index) +
    (-2 * t3 + 3 * t2) * y(index + 1) +
    (t3 - t2) * h * tangent(index + 1)
  );
}

// Rings along a chain of joints at rest (`points[i]` to `points[i + 1]` is bone `bones[i]`), `steps` to a bone, widths from `width`
// (and depths from `depth`) by the share of the way along, blended between bones over `blend` metres either side of each joint.
export function chain(
  points: readonly Vector3[],
  bones: readonly number[],
  steps: number,
  width: (t: number) => number,
  depth: (t: number) => number,
  blend: number,
  extra: Partial<Ring> = {},
): Ring[] {
  const lengths = points
    .slice(1)
    .map((point, index) => point.distanceTo(points[index] ?? point));
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  const rings: Ring[] = [];
  let travelled = 0;
  lengths.forEach((length, bone) => {
    const from = points[bone] ?? new Vector3();
    const to = points[bone + 1] ?? from;
    const last = bone === lengths.length - 1;
    for (let step = 0; step < steps + (last ? 1 : 0); step += 1) {
      const local = step / steps;
      const centre = from.clone().lerp(to, local);
      const t = (travelled + local * length) / total;
      const intoThis = local * length;
      const leftOfNext = (1 - local) * length;
      const own = bones[bone] ?? 0;
      const influence: [number, number][] = [[own, 1]];
      if (bone > 0 && intoThis < blend) {
        const keep = smooth(-blend, blend, intoThis);
        influence[0] = [own, keep];
        influence.push([bones[bone - 1] ?? own, 1 - keep]);
      } else if (!last && leftOfNext < blend) {
        const keep = smooth(-blend, blend, leftOfNext);
        influence[0] = [own, keep];
        influence.push([bones[bone + 1] ?? own, 1 - keep]);
      }
      rings.push({
        ...extra,
        bones: influence,
        centre,
        rx: width(t),
        rz: depth(t),
      });
    }
    travelled += length;
  });
  return rings;
}
