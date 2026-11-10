import { CatmullRomCurve3, Color, type DataTexture, Vector3 } from "three";

import { profile, smooth } from "../body/profile.ts";
import { texture } from "../palette.ts";
import { groundAt } from "./meadow.ts";

// The giant snake's shape, as it was designed in Blender: where it lies asleep and how it rears awake, how thick it is along its
// length, its scales, and the pattern of its skin (see serpent.ts).
export const centre = new Vector3(0, groundAt(0, -18), -18);
export const rows = 240;
export const sides = 16;
const deg = Math.PI / 180;

// Fine at the tail, thick through the loops, a little narrower at the neck.
export const girth = (t: number): number =>
  profile(
    [
      [0, 0.07],
      [0.05, 0.2],
      [0.2, 0.7],
      [0.5, 0.74],
      [0.8, 0.7],
      [0.92, 0.6],
      [1, 0.6],
    ],
    t,
  );

// A point round the hilltop (measured from its middle), `lift` over the ground there.
const over = (x: number, lift: number, z: number): Vector3 =>
  new Vector3(x, groundAt(x, centre.z + z) - centre.y + lift, z);

// Part of a loop: round the hilltop from one angle to another (degrees), drawing in and rising as it goes.
function loop(
  points: Vector3[],
  [from, to, steps]: readonly [number, number, number],
  [r0, r1]: readonly [number, number],
  [y0, y1]: readonly [number, number],
): void {
  for (let step = 1; step <= steps; step += 1) {
    const f = step / steps;
    const a = (from + (to - from) * f) * deg;
    const r = r0 + (r1 - r0) * f;
    points.push(
      over(Math.cos(a) * r, y0 + (y1 - y0) * smooth(0, 1, f), Math.sin(a) * r),
    );
  }
}

// The tail tip curled round the front of the coil, against it; a loop on the ground; a second lying in on the first; then, asleep, a
// small third with the neck laid forward over it and the chin on the coil, or, awake, the neck rearing in an S to a head high over the
// family (who come from +z).
export function path(awake: boolean): CatmullRomCurve3 {
  const points = [
    over(-1.22, 0.1, 4.54),
    over(-2.74, 0.14, 3.51),
    over(-3.58, 0.3, 1.9),
  ];
  loop(points, [150, 510, 14], [3.75, 3.6], [0.5, 0.72]);
  loop(points, [510, 870, 12], [3.6, 2.5], [0.72, 1.7]);
  loop(
    points,
    awake ? [870, 1000, 4] : [870, 1010, 5],
    awake ? [2.5, 1.7] : [2.5, 1.9],
    awake ? [1.7, 2.4] : [1.7, 2.45],
  );
  const neck = awake
    ? [
        [-1, 3.3, -1.1],
        [0.5, 4.6, -1.2],
        [0.8, 5.9, -0.3],
        [0.3, 6.7, 1.1],
        [0, 6.7, 2.4],
      ]
    : [
        [-1.75, 2.62, -0.55],
        [-1.55, 2.66, 0.75],
        [-0.75, 2.6, 1.95],
        [0, 2.5, 2.9],
      ];
  for (const [x = 0, y = 0, z = 0] of neck) points.push(over(x, y, z));
  return new CatmullRomCurve3(points);
}

// Scales: rows of overlapping half-circles, each edged in a fine line that glows gold once healed.
export function scales(): DataTexture {
  const made = texture(64, (x, y) => {
    const row = Math.floor(y / 16);
    const shift = row % 2 === 0 ? 0 : 8;
    const cx = Math.floor((x + shift) / 16) * 16 + 8 - shift;
    const edge = Math.abs(Math.hypot(x - cx, (y % 16) - 2) - 9) < 1.1;
    return edge ? [255, 215, 120, 255] : [0, 0, 0, 255];
  });
  made.repeat.set(2, 0.85);
  return made;
}

// Which of the skin's three tones a point of the body wears: `u` 1 along the back to 0 along the belly, `v` metres along. 1 is the
// dark of the saddles down its back and the line along its side, 2 the pale of its belly, 0 the ground between.
export function toneAt(u: number, v: number): number {
  if (u < 0.2) return 2;
  if (u < 0.26) return 1;
  const along = Math.abs(((v % 2.3) / 2.3 - 0.5) * 2);
  return (1 - u) / 0.5 + along * 0.95 < 0.92 ? 1 : 0;
}

export const greys = ["#8c8aa5", "#524f6c", "#cfccdb"].map(
  (hex) => new Color(hex),
);
export const golds = ["#f0b84c", "#b8741f", "#ffe9b0"].map(
  (hex) => new Color(hex),
);
