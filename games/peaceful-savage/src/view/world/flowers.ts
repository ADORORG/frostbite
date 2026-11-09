import {
  type BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  type MeshToonMaterial,
  SphereGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { painted, type Tone } from "../palette.ts";

// The book's wildflowers: a ring of five petals round a warm eye on a fine stem. Each flower takes its own colour (lupine, poppy, daisy,
// bluebell) from its instance, and glows softly in that colour, so the meadow is dotted with small lights even in the dark.

// A piece of the flower in one colour, kept with it (the instance colour is laid over all of them).
function tinted(
  geometry: BufferGeometry,
  red: number,
  green: number,
  blue: number,
): BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const colours = new Float32Array(count * 3);
  for (let at = 0; at < count; at += 1) colours.set([red, green, blue], at * 3);
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return geometry;
}

export function blossom(): BufferGeometry {
  const petals = Array.from({ length: 5 }, (_, at) =>
    tinted(
      new SphereGeometry(1, 8, 5)
        .scale(0.034, 0.009, 0.018)
        .translate(0.03, 0, 0)
        .rotateZ(0.25)
        .rotateY((at / 5) * Math.PI * 2)
        .translate(0, 0.27, 0),
      1,
      1,
      1,
    ),
  );
  const eye = tinted(
    new SphereGeometry(0.015, 8, 6).translate(0, 0.28, 0),
    1,
    0.78,
    0.32,
  );
  const stem = tinted(
    new CylinderGeometry(0.004, 0.006, 0.27, 4, 1, true).translate(0, 0.135, 0),
    0.3,
    0.55,
    0.3,
  );
  return (
    mergeGeometries([
      ...petals.map((petal) => petal.toNonIndexed()),
      eye.toNonIndexed(),
      stem.toNonIndexed(),
    ]) ?? new SphereGeometry(0.05)
  );
}

// The flowers' paint: their own colour, glowing a little in it.
export function flowerPaint(tone: Tone): MeshToonMaterial {
  const material = painted(tone, { color: "#ffffff", vertexColors: true });
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.35;",
    );
  };
  material.customProgramCacheKey = () => "savage-flower";
  return material;
}
