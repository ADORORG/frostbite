import { Color, Mesh, MeshToonMaterial } from "three";
import { describe, expect, it } from "vitest";

import { buildSparky, sparkySize } from "../src/view/world/sparky.ts";
import { buildTree } from "../src/view/world/tree.ts";
import {
  buildStrand,
  faltering,
  steadyStrands,
} from "../src/view/world/strands.ts";

const materialOf = (mesh: Mesh): MeshToonMaterial => {
  if (!(mesh.material instanceof MeshToonMaterial))
    throw new Error("the strand is not painted");
  return mesh.material;
};

describe("the ancestor tree's three strands", () => {
  it("braids three strands for the trunk: two steady ones in the bark, and a third of its own", () => {
    expect(steadyStrands()).toHaveLength(2);
    const tree = buildTree();
    const third = tree.group.children.filter(
      (child) =>
        child instanceof Mesh &&
        child.geometry.morphAttributes.position !== undefined,
    );
    expect(third).toHaveLength(1);
  });

  it("lets the third strand falter while the house is grey: bowed out of the braid, pulsing and fading", () => {
    const strand = buildStrand();
    const material = materialOf(strand.mesh);
    const seen = new Set<number>();
    for (let time = 0; time < 20; time += 0.05) {
      strand.update(0, time, 0.5);
      expect(material.opacity).toBeLessThan(0.95);
      expect(material.opacity).toBeGreaterThanOrEqual(0.3);
      seen.add(Math.round(material.opacity * 10));
      expect(strand.mesh.morphTargetInfluences?.[0]).toBeGreaterThan(0.9);
    }
    // It pulses and fades: it is sometimes almost gone, and sometimes nearly whole.
    expect(Math.min(...seen)).toBeLessThanOrEqual(3);
    expect(Math.max(...seen)).toBeGreaterThanOrEqual(8);
    for (let time = 0; time < 30; time += 0.01) {
      expect(faltering(time)).toBeGreaterThanOrEqual(0);
      expect(faltering(time)).toBeLessThanOrEqual(1.56);
    }
  });

  it("winds the third strand back into the braid as the family restores the house, steady and gold", () => {
    const strand = buildStrand();
    const material = materialOf(strand.mesh);
    strand.update(1, 4, 0.5);
    expect(material.opacity).toBe(1);
    expect(strand.mesh.morphTargetInfluences?.[0]).toBe(0);
    expect(material.color.getHexString()).toBe(
      new Color("#f2b84b").getHexString(),
    );
    const steady = material.emissiveIntensity;
    strand.update(1, 9, 0.5);
    expect(material.emissiveIntensity).toBeCloseTo(steady, 5);
    strand.update(0.5, 4, 0.5);
    expect(strand.mesh.morphTargetInfluences?.[0]).toBeGreaterThan(0.2);
    expect(strand.mesh.morphTargetInfluences?.[0]).toBeLessThan(0.8);
  });
});

describe("Sparky", () => {
  it("is a small light, a third of the size he was first drawn at, whose light reaches a third as far", () => {
    expect(sparkySize).toBeCloseTo(1 / 3, 10);
    const sparky = buildSparky(true);
    expect(sparky.group.scale.x).toBeCloseTo(1 / 3, 10);
    const light = sparky.group.children.find(
      (child) => "distance" in child && typeof child.distance === "number",
    );
    expect(
      light !== undefined && "distance" in light ? light.distance : 0,
    ).toBeCloseTo(3.5 / 3, 10);
  });
});
