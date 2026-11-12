import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  type Material,
  type Object3D,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { noise } from "../palette.ts";
import { inked } from "../toon.ts";
import { taperedTube } from "./tube.ts";

// Daddy's freeform locs, as the cover paints them: thick ropes of hair that stand up from his head and splay out like a crown, the
// tallest from the top, the ones at the sides leaning out and bowing a little under their own weight, each bent its own way and lumpy
// along its length, dark at the root and browned by the sun toward the tip.
export interface Scalp {
  // The skull the locs grow from, in the head's own units, and where hair may grow on it.
  readonly centre: Vector3;
  readonly radii: Vector3;
  readonly grows: (at: Vector3) => boolean;
  // From the head's own units to its joint's space.
  readonly place: (at: Vector3) => Vector3;
  readonly size: number;
}

const root = new Color("#1d120b");
const tip = new Color("#7a4e2a");

export function locs(
  parent: Object3D,
  scalp: Scalp,
  count: number,
  material: Material,
  seed: number,
): Mesh {
  const random = noise(seed);
  const up = new Vector3(0, 1, 0);
  const pieces: BufferGeometry[] = [];
  for (
    let made = 0, tries = 0;
    made < count && tries < count * 20;
    tries += 1
  ) {
    const d = new Vector3(
      random() * 2 - 1,
      random() * 1.1 - 0.1,
      random() * 2 - 1.1,
    ).normalize();
    const start = d.clone().multiply(scalp.radii).multiplyScalar(0.96);
    start.add(scalp.centre);
    if (d.y < 0.15 || !scalp.grows(start)) continue;
    made += 1;
    const normal = d.clone().divide(scalp.radii).normalize();
    const grow = normal
      .clone()
      .multiplyScalar(0.75)
      .addScaledVector(up, 0.55 + d.y * 0.4)
      .add(
        new Vector3(
          random() - 0.5,
          random() - 0.5,
          random() - 0.5,
        ).multiplyScalar(0.35),
      )
      .normalize();
    const length = (0.8 + random() * 0.65) * (0.55 + d.y * 0.6);
    const bend = grow
      .clone()
      .cross(new Vector3(random() - 0.5, random() - 0.5, random() - 0.5))
      .normalize()
      .multiplyScalar(length * (0.12 + random() * 0.22));
    const droop = length * 0.28 * (1 - d.y);
    const phase = random() * 6;
    const points: Vector3[] = [];
    for (let step = 0; step <= 9; step += 1) {
      const t = step / 9;
      const at = start
        .clone()
        .addScaledVector(grow, length * t)
        .addScaledVector(bend, t * t)
        .add(new Vector3(0, -droop * t * t * t, 0))
        .addScaledVector(normal, Math.sin(t * 7 + phase) * 0.02);
      points.push(scalp.place(at));
    }
    const thick = scalp.size * (0.055 + random() * 0.015);
    const piece = taperedTube(points, {
      radius: (t) =>
        thick * (1 - t * 0.38) * (1 + 0.13 * Math.sin(t * 21 + phase)),
      sides: 7,
    });
    // Dark at the root, lighter toward the tip: the colour of each point by how far along the loc it is.
    const along = piece.getAttribute("uv");
    const colours: number[] = [];
    const total = length * scalp.size;
    const sun = 0.7 + random() * 0.3;
    for (let index = 0; index < along.count; index += 1) {
      const t = Math.min(1, along.getY(index) / Math.max(1e-6, total));
      const colour = root.clone().lerp(tip, t ** 1.6 * sun);
      colours.push(colour.r, colour.g, colour.b);
    }
    piece.setAttribute("color", new Float32BufferAttribute(colours, 3));
    pieces.push(piece);
  }
  const geometry =
    pieces.length > 0
      ? (mergeGeometries(pieces) ?? new BufferGeometry())
      : new BufferGeometry();
  for (const piece of pieces) piece.dispose();
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  inked(mesh, 0.004);
  parent.add(mesh);
  return mesh;
}
