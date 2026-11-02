import {
  PointLight,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three";

import { colour } from "../screen/palette.ts";
import { group, ownPaint, paint, part, shapes } from "./parts.ts";
import { makeEgg } from "./props.ts";

// DeFu's machines and her castle's hall: the egg rocket (portholes full of eggs, fins, an engine, and the shield that covers it while
// the factory runs), the egg factory (an incubator window glowing pink, chimneys smoking, eggs under a glass dome on its roof), her
// platform with its glowing edge, the pillars of the hall and the torches of the dungeon.
export interface Rocket {
  readonly flame: Group;
  readonly root: Group;
  readonly shield: Mesh;
  readonly shieldPaint: MeshStandardMaterial;
}

export function makeRocket(): Rocket {
  const hull = paint(colour.white, { metal: 0.2, rough: 0.35 });
  const red = paint("#c83a5a", { rough: 0.4 });
  const glass = paint(colour.cyan, {
    glow: colour.cyan,
    glowing: 0.5,
    opacity: 0.6,
  });
  const fins = [0, 1, 2, 3].map((at) => {
    const angle = (at / 4) * Math.PI * 2 + Math.PI / 4;
    return part(shapes.block, red, {
      at: [Math.cos(angle) * 0.45, 0.42, Math.sin(angle) * 0.45],
      size: [0.06, 0.6, 0.38],
      turn: [0, -angle, 0],
    });
  });
  const portholes = [1.0, 1.4, 1.8].flatMap((y) => {
    const egg = makeEgg();
    egg.position.set(0, y, 0.36);
    egg.scale.setScalar(0.7);
    return [
      part(shapes.ring, paint(colour.gold, { metal: 0.7 }), {
        at: [0, y, 0.42],
        size: 0.12,
      }),
      part(shapes.ball, glass, { at: [0, y, 0.41], size: [0.11, 0.11, 0.03] }),
      egg,
    ];
  });
  const flame = group(
    [
      part(shapes.cone, paint(colour.fire, { glow: colour.fire, glowing: 2 }), {
        at: [0, -0.35, 0],
        size: [0.28, 0.7, 0.28],
        turn: [Math.PI, 0, 0],
      }),
      part(
        shapes.cone,
        paint(colour.fireHot, { glow: colour.fireHot, glowing: 2.5 }),
        { at: [0, -0.2, 0], size: [0.16, 0.4, 0.16], turn: [Math.PI, 0, 0] },
      ),
    ],
    [0, 0.1, 0],
  );
  flame.visible = false;
  const shieldPaint = ownPaint(colour.cyan, {
    glow: colour.pink,
    glowing: 0.8,
    opacity: 0.22,
    smooth: true,
  });
  const shield = part(shapes.smoothBall, shieldPaint, {
    at: [0, 1.15, 0],
    size: [1.25, 1.75, 1.25],
  });
  shield.castShadow = false;
  const root = group([
    part(shapes.cylinder, hull, { at: [0, 1.25, 0], size: [0.42, 1.9, 0.42] }),
    part(shapes.cone, red, { at: [0, 2.55, 0], size: [0.42, 0.7, 0.42] }),
    part(shapes.cylinder, paint(colour.stoneDark, { metal: 0.6 }), {
      at: [0, 0.2, 0],
      size: [0.3, 0.3, 0.3],
    }),
    ...[0.75, 2.05].map((y) =>
      part(shapes.cylinder, red, { at: [0, y, 0], size: [0.43, 0.08, 0.43] }),
    ),
    ...fins,
    ...portholes,
    flame,
    shield,
  ]);
  return { flame, root, shield, shieldPaint };
}

export interface Factory {
  readonly root: Group;
  readonly smoke: readonly Mesh[];
  readonly window: MeshStandardMaterial;
}

export function makeFactory(): Factory {
  const wall = paint("#6a4f96");
  const roof = paint("#3b2a66");
  const window = ownPaint(colour.pink, { glow: colour.pink, glowing: 1.4 });
  const eggs = [-0.25, 0, 0.25].map((x) => {
    const egg = makeEgg();
    egg.position.set(x, 1.58, 0);
    return egg;
  });
  const smoke = [0, 1, 2, 3, 4, 5].map((at) =>
    part(shapes.rock, paint("#9a93b8", { opacity: 0.5 }), {
      at: [at < 3 ? -0.9 : 0.8, 2.4, -0.35],
      size: 0.18,
    }),
  );
  const pipe = paint(colour.stoneDark, { metal: 0.5 });
  const root = group([
    part(shapes.block, wall, { at: [0, 0.65, 0], size: [2.7, 1.3, 1.7] }),
    part(shapes.block, roof, { at: [0, 1.36, 0], size: [2.9, 0.12, 1.9] }),
    part(shapes.block, window, {
      at: [0, 0.92, 0.86],
      size: [2.2, 0.26, 0.02],
    }),
    part(shapes.block, paint(colour.ink), {
      at: [0, 0.35, 0.86],
      size: [0.46, 0.7, 0.03],
    }),
    part(
      shapes.smoothBall,
      paint(colour.pink, {
        glow: colour.pink,
        glowing: 0.4,
        opacity: 0.35,
        smooth: true,
      }),
      { at: [0, 1.5, 0], size: [0.55, 0.32, 0.4] },
    ),
    ...eggs,
    ...[-0.9, 0.8].map((x) =>
      part(shapes.cylinder, roof, {
        at: [x, 1.85, -0.35],
        size: [0.16, 0.9, 0.16],
      }),
    ),
    part(shapes.cylinder, pipe, {
      at: [-1.6, 0.55, -0.5],
      size: [0.07, 0.6, 0.07],
      turn: [0, 0, Math.PI / 2],
    }),
    part(shapes.cylinder, pipe, {
      at: [1.6, 0.55, -0.5],
      size: [0.07, 0.6, 0.07],
      turn: [0, 0, Math.PI / 2],
    }),
    part(shapes.cylinder, pipe, {
      at: [0, 0.55, 1.2],
      size: [0.07, 0.7, 0.07],
      turn: [Math.PI / 2, 0, 0],
    }),
    ...smoke,
  ]);
  return { root, smoke, window };
}

// The factory works (its window glowing, its chimneys smoking) until its three valves are broken.
export function setFactory(
  factory: Factory,
  working: boolean,
  time: number,
): void {
  factory.window.emissiveIntensity = working
    ? 1.1 + Math.sin(time * 5) * 0.5
    : 0;
  factory.window.color.set(working ? colour.pink : "#3a3248");
  factory.smoke.forEach((puff, at) => {
    const rise = (time * 0.6 + (at % 3) / 3) % 1;
    puff.visible = working;
    puff.position.y = 2.35 + rise * 1.2;
    puff.scale.setScalar(0.12 + rise * 0.22);
  });
}

export function makePlatform(): Group {
  const edge = paint(colour.lavender, { glow: colour.lavender, glowing: 1.2 });
  return group([
    part(shapes.block, paint("#3b2a78"), {
      at: [0, 0.2, 0],
      size: [3.9, 0.4, 1.9],
    }),
    part(shapes.block, paint("#2c1f5c"), {
      at: [0, 0.1, 1.15],
      size: [1.6, 0.2, 0.4],
    }),
    part(shapes.block, edge, { at: [0, 0.41, 0.96], size: [3.9, 0.03, 0.04] }),
    part(shapes.block, edge, { at: [-1.96, 0.41, 0], size: [0.04, 0.03, 1.9] }),
    part(shapes.block, edge, { at: [1.96, 0.41, 0], size: [0.04, 0.03, 1.9] }),
  ]);
}

export function makePillar(): Group {
  const stone = paint(colour.stone);
  return group([
    part(shapes.block, stone, { at: [0, 0.08, 0], size: [0.55, 0.16, 0.55] }),
    part(shapes.cylinder, stone, { at: [0, 0.9, 0], size: [0.22, 1.5, 0.22] }),
    part(shapes.block, stone, { at: [0, 1.7, 0], size: [0.6, 0.16, 0.6] }),
  ]);
}

export interface Torch {
  readonly flame: Mesh;
  readonly light: PointLight;
  readonly root: Group;
}

export function makeTorch(): Torch {
  const flame = part(
    shapes.cone,
    paint(colour.fire, { glow: colour.fire, glowing: 2 }),
    { at: [0, 1.12, 0.32], size: [0.08, 0.2, 0.08] },
  );
  const light = new PointLight(colour.fire, 1.6, 4.5, 1.6);
  light.position.set(0, 1.2, 0.6);
  return {
    flame,
    light,
    root: group([
      part(shapes.cylinder, paint(colour.woodDark), {
        at: [0, 0.92, 0.3],
        size: [0.035, 0.3, 0.035],
        turn: [0.4, 0, 0],
      }),
      flame,
      light,
    ]),
  };
}

export function flicker(torch: Torch, time: number, at: number): void {
  const wave =
    Math.sin(time * 9 + at * 1.7) * 0.5 + Math.sin(time * 23 + at) * 0.25;
  torch.light.intensity = 1.6 + wave * 0.5;
  torch.flame.scale.y = 0.2 + wave * 0.04;
}
