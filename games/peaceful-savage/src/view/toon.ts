import {
  BackSide,
  Color,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  type MeshToonMaterialParameters,
  LinearFilter,
  NearestFilter,
  RedFormat,
  type Skeleton,
  SkinnedMesh,
  Matrix4,
  type BufferGeometry,
} from "three";

import type { Tone } from "./palette.ts";

// The storybook look for the family: light falls in a few painted bands rather than a smooth gradient, a warm gold rim catches every
// edge turned from the eye (the book's gold key light), and a soft brown ink line runs round each shape. A toon material still greys
// with its room, as every painted material does.

// Four painted bands: deep shade, shade, light, full light. Skin of the face takes the same four blended into each other, as an oil
// painter models a face, so a cheek or a jaw turns softly rather than in steps.
const ramps = new Map<boolean, DataTexture>();
export function ramp(soft = false): DataTexture {
  let bands = ramps.get(soft);
  if (bands === undefined) {
    bands = new DataTexture(
      new Uint8Array([92, 150, 214, 255]),
      4,
      1,
      RedFormat,
    );
    bands.minFilter = soft ? LinearFilter : NearestFilter;
    bands.magFilter = soft ? LinearFilter : NearestFilter;
    bands.generateMipmaps = false;
    bands.needsUpdate = true;
    ramps.set(soft, bands);
  }
  return bands;
}

// A room without its colour is not dead grey: it is a moonlit painting in two inks, deep indigo in the shade and silver-lavender in the
// light, and its colour comes back into that.
export const moonlight = `
  float savageLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  vec3 savageInk = mix(vec3(0.42, 0.45, 1.25), vec3(0.86, 0.89, 1.08), smoothstep(0.03, 0.9, savageLum));
  vec3 savageGrey = savageInk * savageLum * 0.85;
  gl_FragColor.rgb = mix(savageGrey, gl_FragColor.rgb, savageColour);`;

const rimAndGrey = `
  float savageEdge = 1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0);
  gl_FragColor.rgb += savageRim * smoothstep(0.62, 0.78, savageEdge);
  ${moonlight}
  #include <dithering_fragment>`;

export interface ToonOptions extends MeshToonMaterialParameters {
  // How strongly the gold rim shows (0 for none).
  readonly rim?: number;
  // Shading blended softly between the bands (for faces).
  readonly soft?: boolean;
}

// A painted toon material tied to a room's colour.
export function toon(tone: Tone, options: ToonOptions): MeshToonMaterial {
  const { rim = 0.22, soft = false, ...parameters } = options;
  const material = new MeshToonMaterial({
    gradientMap: ramp(soft),
    ...parameters,
  });
  const rimColour = new Color("#ffc66b").multiplyScalar(rim);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.savageColour = tone;
    shader.uniforms.savageRim = { value: rimColour };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float savageColour;\nuniform vec3 savageRim;",
      )
      .replace("#include <dithering_fragment>", rimAndGrey);
  };
  material.customProgramCacheKey = () => "savage-toon";
  return material;
}

// The ink line: the shape drawn again a little larger, inside out, in one dark colour (the back faces of a slightly fattened shell).
export function inkMaterial(
  width: number,
  colour = "#2b1610",
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: colour, side: BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.inkWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float inkWidth;",
      )
      .replace(
        "#include <begin_vertex>",
        "vec3 transformed = vec3(position) + normalize(normal) * inkWidth;",
      );
  };
  material.customProgramCacheKey = () => `savage-ink-${String(width)}`;
  return material;
}

// An ink line for a skinned shape: the same skin, bound to the same bones.
export function inkedSkin(
  geometry: BufferGeometry,
  skeleton: Skeleton,
  width: number,
): SkinnedMesh {
  const line = new SkinnedMesh(geometry, inkMaterial(width));
  line.bind(skeleton, new Matrix4());
  line.frustumCulled = false;
  return line;
}

// An ink line for a rigid shape, carried as its child.
export function inked(mesh: Mesh, width: number): Mesh {
  const line = new Mesh(mesh.geometry, inkMaterial(width));
  mesh.add(line);
  return line;
}
