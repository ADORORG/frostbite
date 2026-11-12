import { Vector3 } from "three";

import type { Ring } from "./loft.ts";
import type { ShoeColours } from "./patterns.ts";
import type { Rig, Side } from "./rig.ts";

// Shoes, designed in Blender and grown here from the same rings: each a run of rings from the heel to the toe, in foot lengths from the
// ankle (how far along the foot, how high the ring's middle, half its width, half its height, how square it is), the sole flat on the
// ground. A sneaker is low and round with a thick sole, a boot rises over the ankle, a flat is slim and low. The back of the shoe turns
// with the ankle and its front with the toes, so it bends where a shoe does.
type Last = readonly (readonly [number, number, number, number, number])[];

const lasts: Readonly<Record<ShoeColours["kind"], Last>> = {
  boot: [
    [-0.3, -0.155, 0.14, 0.19, 2.6],
    [-0.2, -0.095, 0.2, 0.25, 2.8],
    [-0.02, -0.025, 0.225, 0.32, 2.6],
    [0.15, -0.105, 0.24, 0.245, 2.6],
    [0.36, -0.2, 0.26, 0.15, 2.8],
    [0.58, -0.227, 0.265, 0.123, 3],
    [0.77, -0.24, 0.23, 0.11, 3],
    [0.9, -0.255, 0.14, 0.09, 2.6],
  ],
  flat: [
    [-0.3, -0.215, 0.13, 0.12, 2.4],
    [-0.2, -0.2, 0.19, 0.145, 2.6],
    [-0.02, -0.225, 0.215, 0.12, 2.6],
    [0.17, -0.255, 0.23, 0.092, 2.6],
    [0.38, -0.265, 0.25, 0.082, 2.8],
    [0.6, -0.27, 0.255, 0.078, 3],
    [0.78, -0.275, 0.215, 0.072, 3],
    [0.9, -0.283, 0.12, 0.062, 2.6],
  ],
  sneaker: [
    [-0.31, -0.165, 0.13, 0.165, 2.4],
    [-0.2, -0.13, 0.2, 0.21, 2.6],
    [-0.02, -0.1, 0.235, 0.245, 2.6],
    [0.17, -0.15, 0.25, 0.2, 2.6],
    [0.38, -0.21, 0.27, 0.14, 2.8],
    [0.6, -0.237, 0.275, 0.113, 3],
    [0.78, -0.25, 0.235, 0.1, 3],
    [0.9, -0.265, 0.14, 0.08, 2.6],
  ],
};

const eased = (t: number): number => t * t * (3 - 2 * t);

// The rings of one shoe on its foot, at rest: `per` rings between each two of the last's.
export function shoeRings(
  rig: Rig,
  side: Side,
  kind: ShoeColours["kind"],
  per = 3,
): Ring[] {
  const foot = rig.build.foot;
  const ankle = rig.joint(`ankle${side}`).getWorldPosition(new Vector3());
  const ankleBone = rig.boneIndex(`ankle${side}`);
  const toeBone = rig.boneIndex(`toes${side}`);
  const last = lasts[kind];
  const rings: Ring[] = [];
  const count = (last.length - 1) * per;
  for (let index = 0; index <= count; index += 1) {
    const along = (index / count) * (last.length - 1);
    const key = Math.min(last.length - 2, Math.floor(along));
    const t = along - key;
    const from = last[key] ?? [0, 0, 0, 0, 2];
    const to = last[key + 1] ?? from;
    const mix = (part: number, by: number): number =>
      (from[part] ?? 0) + ((to[part] ?? 0) - (from[part] ?? 0)) * by;
    const z = mix(0, t);
    // The shoe bends at the ball of the foot, a little behind the toes' own joint.
    const front = Math.max(0, Math.min(1, (z - 0.42) / 0.2));
    rings.push({
      bones: [
        [ankleBone, 1 - front],
        [toeBone, front],
      ],
      centre: ankle
        .clone()
        .add(new Vector3(0, mix(1, eased(t)) * foot, z * foot)),
      round: mix(4, eased(t)),
      runs: "z",
      rx: mix(2, eased(t)) * foot,
      rz: mix(3, eased(t)) * foot,
    });
  }
  return rings;
}
