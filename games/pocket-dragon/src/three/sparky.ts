import { PointLight, type Group, type Mesh, type Scene } from "three";

import { baseTile } from "../rules/woods/base-map.ts";
import { nooks } from "../rules/woods/sparky.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { colour } from "../screen/palette.ts";
import { sparkyAt } from "../screen/sparky-look.ts";
import { group, paint, part, shapes, toward } from "./parts.ts";

// Sparky in three dimensions: a tiny glowing atom (a bright nucleus in three spinning rings, each with its electron) with a light of its
// own, hovering by Glitchy's shoulder or zipping into a nook and back; and a glint in each nook not yet emptied.
export interface SparkyModel {
  readonly glints: readonly Mesh[];
  readonly rings: readonly Group[];
  readonly root: Group;
}

const glintSize = 0.05;
const glowing = (fill: string) =>
  paint(fill, { glow: fill, glowing: 1.6, smooth: true });

export function makeSparky(scene: Scene): SparkyModel {
  const rings = [0, 1, 2].map((at) => {
    const ring = group([
      part(shapes.ring, glowing(colour.cyan), { size: 0.17 }),
      part(shapes.smoothBall, glowing(colour.white), {
        at: [0.17, 0, 0],
        size: 0.026,
      }),
    ]);
    ring.rotation.set(at * 1.05, at * 0.7, 0);
    return ring;
  });
  const light = new PointLight(colour.cyan, 3, 2.6, 1.6);
  const root = group([
    part(shapes.smoothBall, glowing(colour.fireHot), { size: 0.07 }),
    ...rings,
    light,
  ]);
  for (const mesh of root.children) mesh.castShadow = false;
  const glints = nooks.map((nook) => {
    const glint = part(shapes.gem, glowing(colour.fireHot), {
      size: glintSize,
    });
    glint.castShadow = false;
    const tall = baseTile(nook.x, nook.y) === "T" ? 1.1 : 0.8;
    glint.position.set(nook.x + 0.5, tall, nook.y + 0.5);
    return glint;
  });
  scene.add(root, ...glints);
  return { glints, rings, root };
}

export function showSparky(
  model: SparkyModel,
  state: WoodsState,
  base: Base,
  glitchy: readonly [number, number, number],
  time: number,
  dt: number,
): void {
  const rest = { x: glitchy[0] - 0.15, y: glitchy[2] - 1 };
  const at = sparkyAt(base, state.tick, rest);
  const height = glitchy[1] + 0.75 + Math.sin(time * 3) * 0.06;
  const { position } = model.root;
  position.set(
    toward(position.x, at.x + 0.5, dt, 14),
    toward(position.y, height, dt, 8),
    toward(position.z, at.y + 0.5, dt, 14),
  );
  model.rings.forEach((ring, at) => {
    ring.rotation.z = time * (3 + at);
    ring.rotation.y = time * (2 - at * 0.5);
  });
  model.glints.forEach((glint, index) => {
    glint.visible = base.nooksTaken[index] !== true;
    glint.scale.setScalar(
      glintSize * (0.6 + Math.abs(Math.sin(time * 2 + index)) * 0.6),
    );
    glint.rotation.y = time * 2;
  });
}
