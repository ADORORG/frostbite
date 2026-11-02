import type { Group, Mesh, MeshStandardMaterial } from "three";

import { colour } from "../screen/palette.ts";
import { group, ownPaint, paint, part, shapes } from "./parts.ts";

// DeFu and her guards in three dimensions. A guard wears DeFu's turquoise cap and a dark coat with a gold badge, swings its arms as it
// marches, and sees stars when it is dizzy. DeFu stands tall on her platform: deep brown skin, a tall fro-hawk, gold hoops, a turquoise
// V-neck top and wide trousers; she raises an arm and her eyes glow red when her laser is about to strike, and stamps for a shockwave.
export interface Guard {
  readonly arms: readonly [Group, Group];
  readonly root: Group;
  readonly stars: Group;
}

export function makeGuard(): Guard {
  const coat = paint("#2c3266");
  const skin = paint("#8a5a3a");
  const cap = paint("#2ed8c3");
  const arms = [-1, 1].map((side) =>
    group(
      [
        part(shapes.ball, coat, {
          at: [0, -0.12, 0],
          size: [0.06, 0.14, 0.06],
        }),
        part(shapes.ball, skin, { at: [0, -0.27, 0], size: 0.05 }),
      ],
      [side * 0.2, 0.62, 0],
    ),
  );
  const [left, right] = arms;
  if (left === undefined || right === undefined)
    throw new Error("a guard has two arms");
  const stars = group(
    [0, 1, 2].map((at) =>
      part(
        shapes.gem,
        paint(colour.gold, { glow: colour.gold, glowing: 0.8 }),
        {
          at: [
            Math.cos((at * Math.PI * 2) / 3) * 0.2,
            0,
            Math.sin((at * Math.PI * 2) / 3) * 0.2,
          ],
          size: 0.05,
        },
      ),
    ),
    [0, 1.12, 0],
  );
  const body = group([
    ...[-1, 1].map((side) =>
      part(shapes.cylinder, paint(colour.ink), {
        at: [side * 0.08, 0.17, 0],
        size: [0.065, 0.34, 0.065],
      }),
    ),
    part(shapes.ball, coat, { at: [0, 0.52, 0], size: [0.19, 0.24, 0.15] }),
    part(shapes.gem, paint(colour.gold, { metal: 0.6, rough: 0.3 }), {
      at: [0.08, 0.58, 0.14],
      size: 0.035,
    }),
    part(shapes.ball, skin, { at: [0, 0.86, 0], size: 0.14 }),
    ...[-1, 1].map((side) =>
      part(shapes.ball, paint(colour.ink), {
        at: [side * 0.05, 0.88, 0.12],
        size: 0.022,
      }),
    ),
    part(shapes.cylinder, cap, { at: [0, 0.98, 0], size: [0.15, 0.08, 0.15] }),
    part(shapes.cylinder, cap, {
      at: [0, 0.95, 0.07],
      size: [0.13, 0.015, 0.16],
    }),
    left,
    right,
    stars,
  ]);
  return { arms: [left, right], root: group([body]), stars };
}

export function animateGuard(
  guard: Guard,
  time: number,
  walking: boolean,
  dizzy: boolean,
): void {
  const swing = walking ? Math.sin(time * 10) * 0.6 : 0;
  guard.arms[0].rotation.x = swing;
  guard.arms[1].rotation.x = -swing;
  guard.stars.visible = dizzy;
  guard.stars.rotation.y = time * 4;
  guard.root.rotation.z = dizzy ? Math.sin(time * 6) * 0.12 : 0;
}

export interface Defu {
  readonly arm: Group;
  readonly eyes: MeshStandardMaterial;
  readonly root: Group;
}

export function makeDefu(): Defu {
  const skin = paint("#6b3f24");
  const top = paint("#2ed8c3", { rough: 0.4 });
  const trousers = paint("#169a8e", { rough: 0.5 });
  const hair = paint("#140c1c");
  const gold = paint(colour.gold, { metal: 0.8, rough: 0.25 });
  const eyes = ownPaint(colour.white, { glow: "#ff2a3a", glowing: 0 });
  const arm = group(
    [
      part(shapes.ball, skin, { at: [0, -0.2, 0], size: [0.06, 0.22, 0.06] }),
      part(shapes.ball, paint("#ff2a3a", { glow: "#ff2a3a", glowing: 1.5 }), {
        at: [0, -0.44, 0],
        size: 0.07,
      }),
    ],
    [0.25, 1.32, 0],
  );
  // The fro-hawk: a tall crest of hair from the brow to the back of the head, with a purple sheen on top.
  const hawk: Mesh[] = [0, 1, 2].map((at) =>
    part(shapes.smoothBall, at === 2 ? paint("#4a2a6a") : hair, {
      at: [0, 1.8 + at * 0.06, 0.02 - at * 0.07],
      size: [0.085 - at * 0.015, 0.22 - at * 0.03, 0.17 - at * 0.02],
    }),
  );
  const body = group([
    ...[-1, 1].map((side) =>
      part(shapes.cylinder, trousers, {
        at: [side * 0.1, 0.42, 0],
        size: [0.1, 0.84, 0.1],
        turn: [0, 0, side * -0.06],
      }),
    ),
    ...[-1, 1].map((side) =>
      part(shapes.ball, paint(colour.ink), {
        at: [side * 0.11, 0.03, 0.04],
        size: [0.08, 0.04, 0.11],
      }),
    ),
    part(shapes.cylinder, trousers, {
      at: [0, 0.86, 0],
      size: [0.17, 0.14, 0.13],
    }),
    part(shapes.ball, skin, { at: [0, 1.0, 0], size: [0.13, 0.08, 0.1] }),
    part(shapes.ball, top, { at: [0, 1.2, 0], size: [0.19, 0.17, 0.14] }),
    part(shapes.ball, skin, { at: [0, 1.36, 0.02], size: [0.06, 0.07, 0.05] }),
    part(shapes.ball, skin, { at: [0, 1.6, 0], size: [0.15, 0.18, 0.15] }),
    ...hawk,
    ...[-1, 1].flatMap((side) => [
      part(shapes.ball, eyes, {
        at: [side * 0.055, 1.63, 0.13],
        size: [0.03, 0.022, 0.02],
      }),
      part(shapes.ring, gold, {
        at: [side * 0.155, 1.5, 0],
        size: 0.055,
        turn: [0, Math.PI / 2, 0],
      }),
    ]),
    part(shapes.ball, paint("#b8323f"), {
      at: [0, 1.52, 0.13],
      size: [0.045, 0.018, 0.02],
    }),
    group(
      [part(shapes.ball, skin, { at: [0, -0.2, 0], size: [0.06, 0.22, 0.06] })],
      [-0.25, 1.32, 0],
    ),
    arm,
  ]);
  return { arm, eyes, root: group([body]) };
}

// DeFu's arm goes up (and her eyes glow) while her laser glows; she crouches for a stamp when her shockwave goes off.
export function animateDefu(
  defu: Defu,
  time: number,
  aiming: boolean,
  stamping: boolean,
): void {
  defu.arm.rotation.z = aiming ? 2.6 : 0.25 + Math.sin(time * 1.5) * 0.1;
  defu.eyes.emissiveIntensity = aiming ? 2.5 : 0;
  defu.root.scale.y = stamping ? 0.92 : 1 + Math.sin(time * 1.8) * 0.01;
  defu.root.rotation.y = Math.sin(time * 0.7) * 0.25;
}
