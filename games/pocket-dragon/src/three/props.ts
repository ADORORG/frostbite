import type { Group, Mesh, MeshStandardMaterial } from "three";

import { colour } from "../screen/palette.ts";
import { allyLook, animateDragon, makeDragon, type Dragon } from "./dragon.ts";
import { group, ownPaint, paint, part, shapes, toward } from "./parts.ts";

// The things of the woods outside the maze that change as they are used: a chest whose lid swings open on its rocket key, a cage whose
// bars lift to free the dragon in it, a valve wheel of the egg factory that stops and goes dark once broken, a panel of the rocket whose
// light turns from red to green when a key is fitted, the bars of the lair's gate, the forcefield bubble, the heart and a launched egg.
export interface Chest {
  readonly key: Mesh;
  readonly lid: Group;
  readonly root: Group;
}

export function makeChest(): Chest {
  const wood = paint(colour.wood);
  const dark = paint(colour.woodDark);
  const gold = paint(colour.gold, { metal: 0.7, rough: 0.3 });
  const lid = group(
    [
      part(shapes.block, wood, { at: [0, 0.07, 0.2], size: [0.56, 0.14, 0.4] }),
      part(shapes.block, gold, { at: [0, 0.08, 0.41], size: [0.1, 0.1, 0.03] }),
    ],
    [0, 0.34, -0.2],
  );
  const key = part(
    shapes.gem,
    paint(colour.gold, { glow: colour.gold, glowing: 1.2 }),
    { at: [0, 0.5, 0], size: [0.07, 0.14, 0.07] },
  );
  const root = group([
    part(shapes.block, dark, { at: [0, 0.17, 0], size: [0.6, 0.34, 0.42] }),
    part(shapes.block, gold, { at: [0, 0.17, 0], size: [0.62, 0.05, 0.44] }),
    lid,
    key,
  ]);
  return { key, lid, root };
}

export function setChest(
  chest: Chest,
  open: boolean,
  time: number,
  dt: number,
): void {
  chest.lid.rotation.x = toward(chest.lid.rotation.x, open ? -1.9 : 0, dt, 6);
  chest.key.visible = open;
  chest.key.position.y = 0.5 + Math.sin(time * 3) * 0.05;
  chest.key.rotation.y = time * 2;
}

export interface Cage {
  readonly bars: Group;
  readonly dragon: Dragon;
  readonly root: Group;
}

export function makeCage(ally: number): Cage {
  const iron = paint("#2a2440", { metal: 0.5, rough: 0.4 });
  const bars = group([
    ...Array.from({ length: 10 }, (_, at) => {
      const angle = (at / 10) * Math.PI * 2;
      return part(shapes.cylinder, iron, {
        at: [Math.cos(angle) * 0.36, 0.42, Math.sin(angle) * 0.36],
        size: [0.022, 0.84, 0.022],
      });
    }),
    part(shapes.ring, iron, {
      at: [0, 0.84, 0],
      size: [0.36, 0.36, 0.2],
      turn: [Math.PI / 2, 0, 0],
    }),
    part(shapes.cone, paint("#4a3a6a"), {
      at: [0, 1.0, 0],
      size: [0.44, 0.3, 0.44],
    }),
  ]);
  const dragon = makeDragon(allyLook(ally));
  dragon.root.scale.setScalar(0.8);
  const root = group([
    part(shapes.cylinder, paint(colour.stoneDark), {
      at: [0, 0.03, 0],
      size: [0.42, 0.06, 0.42],
    }),
    bars,
    dragon.root,
  ]);
  return { bars, dragon, root };
}

export function setCage(
  cage: Cage,
  freed: boolean,
  time: number,
  dt: number,
): void {
  cage.bars.position.y = toward(cage.bars.position.y, freed ? 2.4 : 0, dt, 3);
  cage.bars.visible = cage.bars.position.y < 2.2;
  cage.dragon.root.visible = !freed;
  if (!freed)
    animateDragon(cage.dragon, time, false, Math.sin(time * 0.8) > 0.6);
}

export interface Valve {
  readonly metal: MeshStandardMaterial;
  readonly root: Group;
  readonly wheel: Group;
}

export function makeValve(): Valve {
  const metal = ownPaint(colour.gold, {
    glow: colour.gold,
    glowing: 0.35,
    metal: 0.7,
    rough: 0.3,
  });
  const wheel = group(
    [
      part(shapes.ring, metal, { size: 0.3 }),
      part(shapes.block, metal, { size: [0.58, 0.05, 0.05] }),
      part(shapes.block, metal, { size: [0.05, 0.58, 0.05] }),
      part(shapes.ball, metal, { size: 0.07 }),
    ],
    [0, 0.85, 0],
  );
  const root = group([
    part(shapes.cylinder, paint(colour.stoneDark, { metal: 0.4 }), {
      at: [0, 0.42, 0],
      size: [0.12, 0.84, 0.12],
    }),
    wheel,
  ]);
  return { metal, root, wheel };
}

export function setValve(
  valve: Valve,
  broken: boolean,
  time: number,
  dt: number,
): void {
  valve.metal.color.set(broken ? "#3a3248" : colour.gold);
  valve.metal.emissiveIntensity = broken ? 0 : 0.25 + Math.sin(time * 4) * 0.15;
  if (!broken) valve.wheel.rotation.z = time * 2;
  valve.wheel.rotation.x = toward(
    valve.wheel.rotation.x,
    broken ? 0.9 : 0,
    dt,
    4,
  );
}

export interface Panel {
  readonly light: MeshStandardMaterial;
  readonly root: Group;
}

export function makePanel(): Panel {
  const light = ownPaint(colour.berry, { glow: colour.berry, glowing: 1.5 });
  const root = group([
    part(shapes.block, paint(colour.stone, { metal: 0.3 }), {
      at: [0, 0.3, 0],
      size: [0.4, 0.6, 0.3],
    }),
    part(shapes.block, paint(colour.ink), {
      at: [0, 0.5, 0.155],
      size: [0.3, 0.16, 0.02],
    }),
    part(shapes.ball, light, { at: [0, 0.66, 0], size: 0.07 }),
  ]);
  return { light, root };
}

export function setPanel(panel: Panel, fitted: boolean, time: number): void {
  const fill = fitted ? colour.mint : colour.berry;
  panel.light.color.set(fill);
  panel.light.emissive.set(fill);
  panel.light.emissiveIntensity = fitted
    ? 1.5
    : 0.6 + Math.abs(Math.sin(time * 4)) * 1.4;
}

export function makeGate(): Group {
  const iron = paint("#2a2440", { metal: 0.6, rough: 0.35 });
  return group([
    ...[-0.36, -0.18, 0, 0.18, 0.36].map((x) =>
      part(shapes.cylinder, iron, {
        at: [x, 0.7, 0],
        size: [0.035, 1.4, 0.035],
      }),
    ),
    part(shapes.block, iron, { at: [0, 1.1, 0], size: [0.9, 0.06, 0.06] }),
    part(shapes.block, iron, { at: [0, 0.4, 0], size: [0.9, 0.06, 0.06] }),
  ]);
}

export function makeBubble(): Mesh {
  return part(
    shapes.smoothBall,
    paint(colour.cyan, {
      glow: colour.cyan,
      glowing: 0.6,
      opacity: 0.45,
      smooth: true,
    }),
    { size: 0.3 },
  );
}

export function makeHeart(): Group {
  const red = paint(colour.berry, { glow: colour.berry, glowing: 0.7 });
  return group([
    part(shapes.ball, red, { at: [-0.09, 0.06, 0], size: [0.11, 0.11, 0.08] }),
    part(shapes.ball, red, { at: [0.09, 0.06, 0], size: [0.11, 0.11, 0.08] }),
    part(shapes.cone, red, {
      at: [0, -0.08, 0],
      size: [0.19, 0.2, 0.08],
      turn: [0, 0, Math.PI],
    }),
  ]);
}

export function makeEgg(): Group {
  return group([
    part(shapes.smoothBall, paint(colour.belly, { smooth: true }), {
      size: [0.11, 0.14, 0.11],
    }),
    ...[0, 1, 2].map((at) =>
      part(
        shapes.ball,
        paint([colour.mint, colour.pink, colour.lavender][at] ?? colour.mint),
        {
          at: [
            Math.cos(at * 2.1) * 0.1,
            (at - 1) * 0.05,
            Math.sin(at * 2.1) * 0.1,
          ],
          size: 0.025,
        },
      ),
    ),
  ]);
}
