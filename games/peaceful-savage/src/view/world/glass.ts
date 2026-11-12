import {
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
} from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

import { glowing } from "../palette.ts";

// Glass that shows what stands before it: the looking glasses on the walls of the house, each an oval in a gold frame, and the still
// pond in the meadow, which shows the sky, the trees and whoever wades in it, with a slow ripple. Each is the world drawn once more, as
// the glass sees it, onto a small picture of its own (only while the glass is on the screen). A glass is silver until it has shown
// someone themself; then it holds a warm gold.
export interface Glass {
  readonly group: Group;
  // Whether it has been used, the time, and whether the lead is near enough (in its room) for it to show the world: a glass far away
  // shows only its own sheen, so the world is drawn again for one glass at a time, not for every one in the house.
  update(used: boolean, time: number, near: boolean): void;
}

const silver = new Color("#aab4d8");
const warm = new Color("#d9b06a");

// The pond's ripple: the picture it shows is drawn a little to one side and the other, in slow rings from its middle.
const rippling = {
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec4 vUv;
    varying vec2 vAt;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      float far = length(vAt);
      vec2 push = vec2(sin(far * 9.0 - time * 1.6), cos(vAt.x * 7.0 + time * 1.1)) * 0.012;
      vec4 at = vUv;
      at.xy += push * at.w;
      vec4 base = texture2DProj(tDiffuse, at);
      // Deep blue toward the middle, and soft at the bank.
      vec3 water = mix(base.rgb, color, 0.3 + 0.12 * sin(far * 9.0 - time * 1.6));
      gl_FragColor = vec4(mix(water, color * 0.6, smoothstep(0.82, 1.0, far) * 0.5), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  name: "PondShader",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    time: { value: 0 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vAt;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vAt = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
};

// The sheen a glass shows while it is too far away to show the world.
const sheen = (colour: string): Mesh =>
  new Mesh(new CircleGeometry(1, 40), new MeshBasicMaterial({ color: colour }));

// The colour a glass lays over what it shows.
const tintOf = (glass: Reflector): Color | null => {
  const material = Array.isArray(glass.material) ? null : glass.material;
  const held: unknown =
    material !== null && "uniforms" in material
      ? (material.uniforms as Record<string, { value: unknown } | undefined>)
          .color?.value
      : null;
  return held instanceof Color ? held : null;
};

// A looking glass, `wide` by `high` (metres, half of each), facing +z with its middle at the origin; `pixels` is how fine its picture.
export function lookingGlass(
  wide: number,
  high: number,
  pixels: number,
): Glass {
  const group = new Group();
  const glass = new Reflector(new CircleGeometry(1, 40), {
    clipBias: 0.003,
    color: silver,
    multisample: 0,
    textureHeight: pixels,
    textureWidth: Math.round((pixels * wide) / high),
  });
  glass.scale.set(wide, high, 1);
  const plain = sheen("#8f97b8");
  plain.scale.set(wide, high, 1);
  const frame = new Mesh(
    new TorusGeometry(1, 0.045, 8, 48),
    glowing("#e0b04a", 0.6),
  );
  frame.scale.set(wide * 1.03, high * 1.02, 0.6);
  group.add(glass, plain, frame);
  const tint = tintOf(glass);
  return {
    group,
    update(used, time, near) {
      glass.visible = near;
      plain.visible = !near;
      tint
        ?.copy(used ? warm : silver)
        .multiplyScalar(1 + Math.sin(time * (used ? 2 : 0.8)) * 0.04);
    },
  };
}

// The pond: lying flat, `wide` by `deep`, its middle at the origin.
export function stillPond(wide: number, deep: number, pixels: number): Glass {
  const group = new Group();
  const water = new Reflector(new CircleGeometry(1, 48), {
    clipBias: 0.003,
    color: new Color("#3a5fae"),
    multisample: 0,
    shader: rippling,
    textureHeight: pixels,
    textureWidth: pixels,
  });
  water.rotation.x = -Math.PI / 2;
  water.scale.set(wide, deep, 1);
  const plain = sheen("#2f4f93");
  plain.rotation.x = -Math.PI / 2;
  plain.scale.set(wide, deep, 1);
  group.add(water, plain);
  const material = Array.isArray(water.material) ? null : water.material;
  const tint = tintOf(water);
  const blue = new Color("#3a5fae");
  const gilded = new Color("#8f8a5c");
  return {
    group,
    update(used, time, near) {
      water.visible = near;
      plain.visible = !near;
      tint?.copy(used ? gilded : blue);
      if (material !== null && "uniforms" in material) {
        const uniforms = material.uniforms as Record<
          string,
          { value: unknown } | undefined
        >;
        if (uniforms.time !== undefined) uniforms.time.value = time;
      }
    },
  };
}
