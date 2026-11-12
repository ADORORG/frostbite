import {
  DoubleSide,
  Group,
  type Material,
  Mesh,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from "three";

import { taperedTube } from "../body/tube.ts";
import { brushed, painted } from "../palette.ts";
import { glassPaint } from "./glass-paint.ts";
import { roofAt } from "./roof.ts";
import type { Rooms } from "./rooms.ts";

// The office's end of the house, as the book paints it: one huge window the whole height of the end wall, straight-sided and rising into
// a tall round arch under the roof, clear glass in a thick gold frame, with gold mullions that lean and bow like the veins of a leaf.
// The office has no ceiling of its own: it is open to the roof, so the window stands the full height of the room. Round steps of
// stone lie at its foot outside.
export const great = { at: 3.5, foot: 0.3, half: 2.6, spring: 3.5, top: 6.05 };
const archUp = (off: number): number =>
  great.spring +
  (great.top - great.spring) *
    Math.sqrt(Math.max(0, 1 - (off / great.half) ** 2));

// Its outline on the wall's face: along the wall (z) and up.
export function greatOutline(): [number, number][] {
  const arch = Array.from({ length: 33 }, (_, step): [number, number] => {
    const off = great.half * Math.cos((step / 32) * Math.PI);
    return [great.at + off, archUp(off)];
  });
  return [
    [great.at - great.half, great.foot],
    [great.at + great.half, great.foot],
    ...arch,
  ];
}

// What is drawn on the end wall's face (along, up) stood where the wall is.
const stood = (points: readonly (readonly [number, number])[], x: number) =>
  points.map(([along, up]) => new Vector3(x, up, along));

export function buildGreatWindow(rooms: Rooms, rib: Material): Group {
  const group = new Group();
  const outline = greatOutline();
  const pane = new Shape();
  outline.forEach(([along, up], index) => {
    if (index === 0) pane.moveTo(along, up);
    else pane.lineTo(along, up);
  });
  group.add(
    new Mesh(
      new ShapeGeometry(pane).rotateY(-Math.PI / 2).translate(12, 0, 0),
      glassPaint(),
    ),
  );
  const [first] = outline;
  const frame = new Mesh(
    taperedTube(stood(first ? [...outline, first] : outline, 12), {
      radius: () => 0.11,
      sides: 8,
    }),
    rib,
  );
  group.add(frame);
  // The mullions: two that lean out as they climb, and two that bow across, like the veins of a leaf.
  for (const side of [-1, 1]) {
    const ends = 1.55;
    const lean = Array.from({ length: 13 }, (_, step): [number, number] => {
      const t = step / 12;
      return [
        great.at + side * (0.7 + (ends - 0.7) * t * t),
        great.foot + (archUp(ends) - great.foot) * t,
      ];
    });
    group.add(
      new Mesh(
        taperedTube(stood(lean, 12), { radius: () => 0.05, sides: 6 }),
        rib,
      ),
    );
  }
  for (const [high, bow] of [
    [2.3, 0.45],
    [4.1, 0.4],
  ] as const) {
    const reach =
      high < great.spring
        ? great.half
        : great.half *
          Math.sqrt(
            1 - ((high - great.spring) / (great.top - great.spring)) ** 2,
          );
    const across = Array.from({ length: 17 }, (_, step): [number, number] => {
      const off = (step / 8 - 1) * reach;
      return [great.at + off, high + bow * (1 - (off / reach) ** 2)];
    });
    group.add(
      new Mesh(
        taperedTube(stood(across, 12), { radius: () => 0.05, sides: 6 }),
        rib,
      ),
    );
  }
  // The steps at its foot, outside: two low rounds of warm stone.
  const stone = painted(rooms.tones.meadow, { color: "#c9b79a" });
  for (const [reach, high] of [
    [3.2, 0.06],
    [2.5, 0.13],
  ] as const) {
    const step = new Mesh(new SphereGeometry(1, 28, 8), stone);
    step.scale.set(reach * 0.5, high, reach);
    step.position.set(12.3, 0, great.at);
    step.receiveShadow = true;
    group.add(step);
  }
  // Inside, the office's other walls carried up to the roof: over the wall to the hall, and over the wall to the parents' room.
  const cream = painted(rooms.tones.office, {
    color: "#efe2c8",
    map: brushed("#f1e4cb", 47, 1, 0.4),
    side: DoubleSide,
  });
  const hall = new Shape();
  hall.moveTo(0, 3.4);
  hall.lineTo(7, 3.4);
  for (let z = 7; z >= 0; z -= 0.25) hall.lineTo(z, roofAt(3, z) + 0.06);
  const back = new Shape();
  back.moveTo(3, 3.4);
  back.lineTo(12, 3.4);
  for (let x = 12; x >= 3; x -= 0.25) back.lineTo(x, roofAt(x, 7) + 0.06);
  group.add(
    new Mesh(
      new ShapeGeometry(hall).rotateY(-Math.PI / 2).translate(3, 0, 0),
      cream,
    ),
    new Mesh(new ShapeGeometry(back).translate(0, 0, 7), cream),
  );
  return group;
}
