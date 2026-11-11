// @vitest-environment jsdom
import { Mesh, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import type { Models } from "../src/screen/models/load.ts";
import { modelNames } from "../src/screen/models/packed.ts";
import { models } from "./support/view.ts";

let all: Models;
beforeAll(async () => {
  all = await models();
}, 60_000);

// How far the furthest point of a mesh is from the middle of the bounds its file gave it, and how wide those bounds are.
function reach(mesh: Mesh): { readonly far: number; readonly radius: number } {
  const sphere = mesh.geometry.boundingSphere;
  if (sphere === null) throw new Error(`${mesh.name} has no bounds`);
  const position = mesh.geometry.getAttribute("position");
  const point = new Vector3();
  let far = 0;
  for (let at = 0; at < position.count; at += 1)
    far = Math.max(
      far,
      point.fromBufferAttribute(position, at).distanceTo(sphere.center),
    );
  return { far, radius: sphere.radius };
}

describe("the packed models", () => {
  it("are every one there, with a mesh to draw", () => {
    expect(modelNames).toHaveLength(16);
    for (const name of modelNames) {
      let meshes = 0;
      all(name).scene.traverse((part) => {
        if (part instanceof Mesh) meshes += 1;
      });
      expect(meshes, name).toBeGreaterThan(0);
    }
  });

  // three.js leaves out a mesh whose bounds are outside the picture. Bounds too small (a packer that scaled them twice made each a
  // point) make the ground vanish as soon as its middle leaves the view, with the hero still standing on it.
  it("give every mesh bounds that hold all of its points, and no wider than twice what it needs", () => {
    for (const name of modelNames)
      all(name).scene.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        const { far, radius } = reach(part);
        expect(radius, `${name} ${part.name}`).toBeGreaterThanOrEqual(
          far * 0.999,
        );
        expect(radius, `${name} ${part.name}`).toBeLessThan(far * 2 + 0.001);
      });
  });
});
