import {
  Color,
  type ColorRepresentation,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  type MeshToonMaterial,
  RepeatWrapping,
  RGBAFormat,
  type Side,
  SRGBColorSpace,
  type Texture,
} from "three";

import { moonlight, toon } from "./toon.ts";

// The book's look in one place: a warm painted world whose grey state and gold state are two palettes of the same paint. Every painted
// material is given the colour of its room (0 grey to 1 full) and mixes toward grey by it, after it is lit, so a room greys and warms
// back as one. Glowing gold line-work is never greyed: it is the magic coming back.
export interface Tone {
  value: number;
}

export const gold = new Color("#ffc74a");
export const deepGold = new Color("#e09a1e");
export const night = new Color("#120b2e");

const greyMix = `${moonlight}
  #include <dithering_fragment>`;

// Ties a material to a room's colour.
export function paint<Material extends MeshStandardMaterial>(
  material: Material,
  tone: Tone,
): Material {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.savageColour = tone;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float savageColour;",
      )
      .replace("#include <dithering_fragment>", greyMix);
  };
  material.customProgramCacheKey = () => "savage-colour";
  return material;
}

// A painted material for a room: the storybook look (light in painted bands with a touch of gold at the edges), greying with its room.
export interface PaintParameters {
  readonly color?: ColorRepresentation;
  readonly emissive?: ColorRepresentation;
  readonly emissiveIntensity?: number;
  readonly emissiveMap?: Texture | null;
  readonly map?: Texture | null;
  readonly opacity?: number;
  readonly side?: Side;
  readonly transparent?: boolean;
  readonly vertexColors?: boolean;
}

export const painted = (
  tone: Tone,
  parameters: PaintParameters,
): MeshToonMaterial => toon(tone, { rim: 0.1, ...parameters });

// A material that glows and is never greyed.
export const glowing = (colour: Color | string, strength = 2.2) =>
  new MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: strength,
    roughness: 0.4,
  });

// A small seeded noise for textures (the view's own; the rules never use it).
export function noise(seed: number): () => number {
  let state = seed >>> 0 || 7;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

// A texture painted pixel by pixel: `paintPixel` gives each one its colour as four bytes.
export function texture(
  size: number,
  paintPixel: (
    x: number,
    y: number,
  ) => readonly [number, number, number, number],
  repeat = 1,
): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const pixel = paintPixel(x, y);
      data.set(pixel, (y * size + x) * 4);
    }
  const made = new DataTexture(data, size, size, RGBAFormat);
  made.colorSpace = SRGBColorSpace;
  made.wrapS = RepeatWrapping;
  made.wrapT = RepeatWrapping;
  made.repeat.set(repeat, repeat);
  made.magFilter = LinearFilter;
  made.minFilter = LinearMipmapLinearFilter;
  made.generateMipmaps = true;
  made.needsUpdate = true;
  return made;
}

const byte = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

// A colour as the three bytes a picture stores (colours are kept linear in the scene; pictures are sRGB).
const spare = { b: 0, g: 0, r: 0 };
export function srgb(colour: Color): [number, number, number] {
  colour.getRGB(spare, SRGBColorSpace);
  return [byte(spare.r * 255), byte(spare.g * 255), byte(spare.b * 255)];
}

// Visible brushwork: a colour broken by soft streaks, as an oil painting's flat areas are.
export function brushed(
  base: string,
  seed: number,
  repeat = 2,
  strength = 1,
): DataTexture {
  const [red, green, blue] = srgb(new Color(base));
  const random = noise(seed);
  const streaks = Array.from({ length: 64 }, () => random() * 0.16 - 0.08);
  return texture(
    64,
    (x, y) => {
      const lift =
        ((streaks[(x + Math.floor(y / 6)) % 64] ?? 0) +
          (random() - 0.5) * 0.05) *
        strength;
      return [
        byte(red + lift * 255),
        byte(green + lift * 255),
        byte(blue + lift * 1.2 * 255),
        255,
      ];
    },
    repeat,
  );
}

// Mama Heerah's markings, and the jackets' sigils: gold lines on a transparent ground, for an emissive map.
export function sigils(seed: number, density = 1): DataTexture {
  const random = noise(seed);
  const strokes = Array.from({ length: Math.round(18 * density) }, () => ({
    a: random() * Math.PI,
    r: 4 + random() * 10,
    x: random() * 64,
    y: random() * 64,
  }));
  return texture(64, (x, y) => {
    const lit = strokes.some((s) => {
      const d = Math.hypot(x - s.x, y - s.y);
      const ring =
        Math.abs(d - s.r) < 0.7 &&
        Math.sin(Math.atan2(y - s.y, x - s.x) * 3 + s.a) > 0;
      return (
        ring ||
        (Math.abs((x - s.x) * Math.sin(s.a) - (y - s.y) * Math.cos(s.a)) <
          0.5 &&
          d < s.r)
      );
    });
    return lit ? [255, 205, 90, 255] : [0, 0, 0, 255];
  });
}

// A soft round glow, bright in the middle and gone at the edge, for light that hangs in the air.
let glowTexture: DataTexture | null = null;
export function softGlow(): DataTexture {
  glowTexture ??= texture(64, (x, y) => {
    const d = Math.min(1, Math.hypot(x - 31.5, y - 31.5) / 31.5);
    const a = Math.pow(1 - d, 2.2);
    return [255, 255, 255, byte(a * 255)];
  });
  glowTexture.colorSpace = "";
  return glowTexture;
}

// Wooden boards: rows of planks of different lengths, each a little different in shade, with a dark seam between them and a soft grain.
export function planks(base: string, seed: number, repeat = 3): DataTexture {
  const [red, green, blue] = srgb(new Color(base));
  const random = noise(seed);
  const rows = 8;
  const cuts = Array.from({ length: rows }, () => [
    random() * 0.5,
    0.5 + random() * 0.5,
  ]);
  const shades = Array.from({ length: rows * 3 }, () => 0.86 + random() * 0.22);
  return texture(
    128,
    (x, y) => {
      const row = Math.floor(y / 16);
      const [first = 0.3, second = 0.8] = cuts[row] ?? [];
      const u = x / 128;
      const board = u < first ? 0 : u < second ? 1 : 2;
      const seam =
        y % 16 === 0 ||
        Math.abs(u - first) < 0.008 ||
        Math.abs(u - second) < 0.008;
      const grain =
        0.94 + Math.sin(x * 0.35 + row * 7 + Math.sin(y * 0.9) * 2) * 0.05;
      const shade = (seam ? 0.55 : (shades[row * 3 + board] ?? 1)) * grain;
      return [byte(red * shade), byte(green * shade), byte(blue * shade), 255];
    },
    repeat,
  );
}

// Glazed tiles: squares with pale grout and a gloss streak across each.
export function tiles(base: string, seed: number, repeat = 6): DataTexture {
  const [red, green, blue] = srgb(new Color(base));
  const random = noise(seed);
  const shades = Array.from({ length: 16 }, () => 0.9 + random() * 0.16);
  return texture(
    64,
    (x, y) => {
      const grout = x % 32 < 2 || y % 32 < 2;
      const shade = grout
        ? 1.35
        : (shades[Math.floor(x / 32) + Math.floor(y / 32) * 2] ?? 1) *
          (1 + Math.max(0, 0.12 - Math.abs(((x + y) % 32) - 12) * 0.03));
      return [byte(red * shade), byte(green * shade), byte(blue * shade), 255];
    },
    repeat,
  );
}

// A painted night for the hall's vault: stars of every size on black (an emissive picture, so only the stars glow).
export function starMap(seed: number): DataTexture {
  const random = noise(seed);
  const stars = Array.from({ length: 140 }, () => ({
    r: 0.6 + random() ** 3 * 3,
    x: random() * 256,
    y: random() * 256,
  }));
  return texture(256, (x, y) => {
    let light = 0;
    for (const star of stars) {
      const d = Math.hypot(x - star.x, y - star.y);
      if (d < star.r * 3)
        light = Math.max(
          light,
          Math.max(0, 1 - d / star.r) +
            (star.r > 2.4 &&
            (Math.abs(x - star.x) < 0.8 || Math.abs(y - star.y) < 0.8)
              ? Math.max(0, 1 - d / (star.r * 3))
              : 0),
        );
    }
    const v = byte(Math.min(1, light) * 255);
    return [v, byte(v * 0.92), byte(v * 0.75), 255];
  });
}
