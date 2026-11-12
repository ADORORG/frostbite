import {
  Color,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";

import { curls } from "../src/view/body/coils.ts";
import { headOf } from "../src/view/body/head-shape.ts";
import { looks } from "../src/view/body/looks.ts";
import { scalp } from "../src/view/body/scalp.ts";

const placeOf = (mesh: InstancedMesh, at: number): Vector3 => {
  const matrix = new Matrix4();
  mesh.getMatrixAt(at, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
};
const colourOf = (mesh: InstancedMesh, at: number): number => {
  const colour = new Color();
  mesh.getColorAt(at, colour);
  return colour.r + colour.g + colour.b;
};

describe("coily hair", () => {
  it("packs a puff's coils through its outer shell, dark at the root and lighter at the tip, with a halo standing free", () => {
    const radii = new Vector3(1, 1, 1);
    const mesh = curls(
      new Object3D(),
      { count: 400, halo: 0.25, keep: () => true, radii, size: 0.05 },
      new MeshBasicMaterial(),
      looks.kai,
      7,
      1,
    );
    expect(mesh.count).toBe(500);
    const packed = Array.from({ length: 400 }, (_, at) => placeOf(mesh, at));
    const free = Array.from({ length: 100 }, (_, at) =>
      placeOf(mesh, 400 + at),
    );
    // The body of the puff lies in its outer shell (the outline swells and dips a little); the halo stands just past it.
    for (const at of packed) expect(at.length()).toBeGreaterThan(0.7);
    for (const at of packed) expect(at.length()).toBeLessThan(1.1);
    const mean = (all: Vector3[]) =>
      all.reduce((sum, at) => sum + at.length(), 0) / all.length;
    expect(mean(free)).toBeGreaterThan(mean(packed) + 0.08);
    // Deeper coils are darker than the ones at the outline.
    const order = packed
      .map((at, index) => ({ far: at.length(), light: colourOf(mesh, index) }))
      .sort((a, b) => a.far - b.far);
    const light = (from: number, to: number) =>
      order.slice(from, to).reduce((sum, one) => sum + one.light, 0);
    expect(light(300, 400)).toBeGreaterThan(light(0, 100));
    // With no halo asked for, there is none; and a keeper that refuses everywhere still places every coil.
    const bare = curls(
      new Object3D(),
      { count: 40, keep: () => false, radii, size: 0.05 },
      new MeshBasicMaterial(),
      looks.zora,
      9,
      1,
    );
    expect(bare.count).toBe(40);
  });

  it("grows the close hair from the skin itself, only where hair grows, and fades it short toward the ears", () => {
    const head = headOf(looks.kai.face);
    const grows = (at: Vector3) => at.y > head.layout.brow + 0.2;
    const parent = new Object3D();
    const mesh = scalp(parent, head, {
      cap: new MeshBasicMaterial(),
      colour: "#1b120c",
      count: 300,
      detail: 1,
      grows,
      long: (at) => (at.y > 0.8 ? 1 : 0.1),
      material: new MeshBasicMaterial(),
      place: (at) => at.clone(),
      size: 0.05,
    });
    // The cap and the coils.
    expect(parent.children).toHaveLength(2);
    const matrix = new Matrix4();
    const [at, scale] = [new Vector3(), new Vector3()];
    for (let index = 0; index < 300; index += 1) {
      mesh.getMatrixAt(index, matrix);
      at.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      // On the skin (within a coil's length of it), above the hairline.
      expect(Math.abs(head.distance(at, true))).toBeLessThan(0.06);
      expect(at.y).toBeGreaterThan(head.layout.brow + 0.15);
      // Long on the crown, a shadow lower down.
      if (at.y > 0.85) expect(scale.y).toBeGreaterThan(scale.x);
      if (at.y < 0.75) expect(scale.y).toBeLessThan(scale.x * 0.5);
    }
  });
});
