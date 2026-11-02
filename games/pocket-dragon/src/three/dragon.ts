import type { Group, Mesh } from "three";

import { colour, friendColours } from "../screen/palette.ts";
import { group, ownPaint, paint, part, shapes, type Finish } from "./parts.ts";

// A baby dragon in three dimensions, jointed so it can walk, flap and swish: a round body and belly, a big head with shining eyes, little
// horns and blushing cheeks, spikes down its back, two wings, four stubby legs, and a tail of shrinking joints that breaks into pixels at
// the tip, as Glitchy's does. It faces +z (towards the camera) when not turned. Glitchy, the dragons it frees (in their own colours) and
// DeFu's shadow dragons (dark, see-through, red-eyed) are all this one model.
export interface DragonLook {
  readonly belly: string;
  readonly body: string;
  readonly eyes: string;
  // Red-glowing eyes, for DeFu's shadow dragons.
  readonly glare?: boolean;
  readonly horns: string;
  readonly opacity?: number;
  readonly pixels: readonly string[];
  readonly shade: string;
  readonly spikes: string;
  readonly wings: string;
}

export const glitchyLook: DragonLook = {
  belly: colour.belly,
  body: colour.mint,
  eyes: colour.eye,
  horns: colour.cream,
  pixels: [colour.cyan, colour.mint, colour.lavender],
  shade: colour.mintDark,
  spikes: colour.pink,
  wings: colour.lavender,
};

export function allyLook(ally: number): DragonLook {
  const [body, shade] = friendColours[ally] ?? ["#ff9f43", "#c4661c"];
  return { ...glitchyLook, body, pixels: [body, shade], shade, wings: shade };
}

export const shadowLook: DragonLook = {
  belly: "#5a3a8a",
  body: "#3b2266",
  eyes: colour.berry,
  glare: true,
  horns: "#2a1840",
  opacity: 0.88,
  pixels: ["#5a3a8a", colour.berry],
  shade: "#2a1840",
  spikes: colour.berry,
  wings: "#2a1840",
};

export interface Dragon {
  readonly body: Group;
  readonly head: Group;
  readonly legs: readonly Group[];
  readonly pixels: readonly Mesh[];
  readonly root: Group;
  readonly tail: readonly Group[];
  readonly wings: readonly [Group, Group];
}

const legSpots: readonly (readonly [number, number, number])[] = [
  [0.13, 0.12, 0.12],
  [-0.13, 0.12, 0.12],
  [-0.14, 0.12, -0.13],
  [0.14, 0.12, -0.13],
];

export function makeDragon(look: DragonLook): Dragon {
  const finish: Finish =
    look.opacity === undefined ? {} : { opacity: look.opacity };
  const coat =
    look.opacity === undefined ? paint(look.body) : ownPaint(look.body, finish);
  const shade =
    look.opacity === undefined
      ? paint(look.shade)
      : ownPaint(look.shade, finish);
  const belly = paint(look.belly);
  const ink = paint(colour.ink, { rough: 0.3 });
  const eye =
    look.glare === true
      ? paint(look.eyes, { glow: look.eyes, glowing: 2 })
      : paint(colour.white, { rough: 0.2 });
  const pupil = look.glare === true ? eye : paint(look.eyes, { rough: 0.2 });
  const shine = paint(colour.white, { glow: colour.white, glowing: 0.6 });
  const head = group(
    [
      part(shapes.ball, coat, { size: [0.21, 0.19, 0.2] }),
      part(shapes.ball, coat, {
        at: [0, -0.05, 0.16],
        size: [0.14, 0.1, 0.12],
      }),
      ...[-1, 1].flatMap((side) => [
        part(shapes.ball, ink, {
          at: [side * 0.04, -0.02, 0.275],
          size: 0.016,
        }),
        part(shapes.ball, eye, {
          at: [side * 0.085, 0.04, 0.135],
          size: 0.068,
        }),
        part(shapes.ball, pupil, {
          at: [side * 0.09, 0.04, 0.185],
          size: 0.04,
        }),
        part(shapes.ball, shine, {
          at: [side * 0.078, 0.065, 0.21],
          size: 0.014,
        }),
        part(shapes.cone, paint(look.horns), {
          at: [side * 0.09, 0.2, -0.05],
          size: [0.035, 0.15, 0.035],
          turn: [-0.45, 0, side * -0.25],
        }),
        part(shapes.ball, paint(colour.blush), {
          at: [side * 0.145, -0.045, 0.12],
          size: [0.03, 0.02, 0.02],
        }),
      ]),
    ],
    [0, 0.64, 0.15],
  );
  const wings = [-1, 1].map((side) =>
    group(
      [
        part(shapes.rock, paint(look.wings), {
          at: [side * 0.17, 0.05, -0.03],
          size: [0.24, 0.02, 0.15],
          turn: [0, side * 0.35, side * 0.25],
        }),
        part(shapes.cylinder, shade, {
          at: [side * 0.13, 0.08, 0.02],
          size: [0.015, 0.26, 0.015],
          turn: [0, 0, side * 1.2],
        }),
      ],
      [side * 0.17, 0.45, -0.1],
    ),
  );
  const [left, right] = wings;
  if (left === undefined || right === undefined)
    throw new Error("a dragon has two wings");
  const pixels = look.pixels.flatMap((fill, at) => [
    part(shapes.block, paint(fill, { glow: fill, glowing: 0.5 }), {
      at: [(at - 1) * 0.05, at * 0.035, -0.08 - at * 0.04],
      size: 0.045,
    }),
  ]);
  const radii = [0.11, 0.085, 0.065, 0.045];
  let tip = group([...pixels], [0, 0, -0.1]);
  const tail: Group[] = [];
  for (let joint = radii.length - 1; joint >= 0; joint -= 1) {
    const r = radii[joint] ?? 0.05;
    tip = group(
      [
        part(shapes.ball, joint % 2 === 0 ? coat : shade, {
          size: [r, r, 0.11],
        }),
        tip,
      ],
      joint === 0 ? [0, 0.24, -0.27] : [0, -0.01, -0.12],
    );
    tail.unshift(tip);
  }
  const legs = legSpots.map((spot) =>
    group(
      [
        part(shapes.ball, coat, { at: [0, -0.03, 0], size: [0.07, 0.1, 0.08] }),
        part(shapes.ball, shade, {
          at: [0, -0.1, 0.025],
          size: [0.075, 0.035, 0.09],
        }),
      ],
      spot,
    ),
  );
  const body = group([
    part(shapes.ball, coat, { at: [0, 0.33, 0], size: [0.27, 0.25, 0.3] }),
    part(shapes.ball, belly, { at: [0, 0.31, 0.19], size: [0.2, 0.2, 0.12] }),
    part(shapes.ball, coat, { at: [0, 0.5, 0.11], size: 0.14 }),
    ...[0, 1, 2, 3].map((at) =>
      part(shapes.cone, paint(look.spikes), {
        at: [0, 0.56 - at * 0.075, -0.1 - at * 0.075],
        size: [0.04, 0.1, 0.04],
        turn: [-0.5 - at * 0.25, 0, 0],
      }),
    ),
    ...[-1, 1].map((side) =>
      part(shapes.ball, coat, { at: [side * 0.17, 0.35, 0.16], size: 0.05 }),
    ),
    head,
    left,
    right,
    ...tail.slice(0, 1),
    ...legs,
  ]);
  return {
    body,
    head,
    legs,
    pixels,
    root: group([body]),
    tail,
    wings: [left, right],
  };
}

// Plays the dragon on: a bob and alternating legs while it walks, a breath while it stands, wings beating (fast when `flap`), the tail
// swishing joint by joint, the head nodding and the pixels of the tail turning.
export function animateDragon(
  dragon: Dragon,
  time: number,
  walking: boolean,
  flap = false,
): void {
  const stride = walking ? Math.sin(time * 15) : 0;
  dragon.body.position.y = walking
    ? Math.abs(stride) * 0.05
    : Math.sin(time * 2.2) * 0.012;
  dragon.legs.forEach((leg, at) => {
    const swing = at % 2 === 0 ? stride : -stride;
    leg.position.y = (legSpots[at]?.[1] ?? 0.12) + Math.max(0, swing) * 0.05;
    leg.rotation.x = swing * 0.5;
  });
  const beat = flap
    ? 0.3 + Math.sin(time * 20) * 0.7
    : 0.3 + Math.sin(time * 3) * 0.12;
  dragon.wings[0].rotation.z = -beat;
  dragon.wings[1].rotation.z = beat;
  dragon.tail.forEach((joint, at) => {
    joint.rotation.y = Math.sin(time * 3 - at * 0.7) * 0.25;
  });
  dragon.head.rotation.x = Math.sin(time * 1.7) * 0.05;
  dragon.pixels.forEach((pixel, at) => {
    pixel.rotation.set(time * (1 + at), time * 0.7, 0);
  });
}
