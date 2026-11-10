import { Color, type DataTexture } from "three";

import { noise, srgb, texture } from "../palette.ts";

// Painted cloth and skin patterns. Each is a picture wrapped round a part: across the picture is round the part, down it is along it.

const rgba = (colour: Color): [number, number, number, number] => [
  ...srgb(colour),
  255,
];

// The weave: cloth is never one flat colour.
const weave = (
  colour: Color,
  x: number,
  y: number,
  random: () => number,
): Color =>
  colour
    .clone()
    .multiplyScalar(0.94 + ((x * 7 + y * 3) % 5) * 0.012 + random() * 0.03);

// Kai's pyjamas: navy with gold five-pointed stars and crescent moons, scattered.
export function starCloth(
  base: string,
  mark: string,
  seed: number,
): DataTexture {
  const ground = new Color(base);
  const ink = new Color(mark);
  const random = noise(seed);
  const size = 128;
  const marks = Array.from({ length: 9 }, (_, at) => ({
    moon: at % 3 === 2,
    spin: random() * Math.PI,
    x: ((at % 3) + random() * 0.6) * (size / 3),
    y: (Math.floor(at / 3) + random() * 0.6) * (size / 3),
  }));
  return texture(
    size,
    (x, y) => {
      const on = marks.some((m) => {
        const dx = ((x - m.x + size * 1.5) % size) - size / 2;
        const dy = ((y - m.y + size * 1.5) % size) - size / 2;
        const d = Math.hypot(dx, dy);
        if (m.moon) return d < 7 && Math.hypot(dx - 3.2, dy - 1.5) > 5.6;
        const angle = Math.atan2(dy, dx) + m.spin;
        return d < 3.2 + 3.4 * Math.max(0, Math.cos(angle * 5)) ** 2;
      });
      return rgba(on ? ink : weave(ground, x, y, random));
    },
    2,
  );
}

// Cloth with a gold band: Mama's skirt (the band near the hem) and her top (gold at both edges).
export function trimCloth(
  base: string,
  trim: string,
  bands: readonly (readonly [number, number])[],
  seed: number,
): DataTexture {
  const ground = new Color(base);
  const gold = new Color(trim);
  const random = noise(seed);
  const size = 128;
  return texture(size, (x, y) => {
    const v = y / size;
    const band = bands.find(([from, to]) => v >= from && v <= to);
    if (band === undefined) return rgba(weave(ground, x, y, random));
    // Inside a band: a zigzag of gold between two gold lines.
    const t = (v - band[0]) / (band[1] - band[0]);
    const zig = Math.abs(((x / 16) % 1) - 0.5) * 2;
    const line = t < 0.14 || t > 0.86 || Math.abs(t - 0.2 - zig * 0.6) < 0.09;
    return rgba(
      line ? gold : weave(ground.clone().multiplyScalar(0.8), x, y, random),
    );
  });
}

// Mama's markings: gold bands of chevrons, dots and fine lines round her arms, on black (an emissive picture: only the gold glows).
export function markings(): DataTexture {
  const size = 128;
  return texture(size, (x, y) => {
    const v = y / size;
    const u = x / size;
    const zig = Math.abs(((u * 10) % 1) - 0.5) * 2;
    const chevrons =
      v > 0.12 && v < 0.3 && Math.abs(v - 0.15 - zig * 0.12) < 0.018;
    const lines =
      Math.abs(v - 0.1) < 0.008 ||
      Math.abs(v - 0.32) < 0.008 ||
      Math.abs(v - 0.72) < 0.008;
    const dot = Math.hypot(((u * 14) % 1) - 0.5, (v - 0.42) * 14) < 0.2;
    const lit = chevrons || lines || dot;
    return lit ? [255, 200, 92, 255] : [0, 0, 0, 255];
  });
}

// Ribbed knit, for a collar, a cuff or a waistband: fine ridges along the part, dark between them.
export function ribCloth(base: string, seed: number): DataTexture {
  const ground = new Color(base);
  const random = noise(seed);
  return texture(
    64,
    (x, y) =>
      rgba(weave(ground, x, y, random).multiplyScalar(x % 4 < 2 ? 1.08 : 0.72)),
    3,
  );
}

// The colours of a maridium jacket: its ground, three bold colours worked into it, and the shirt that shows where it hangs open.
export interface JacketColours {
  readonly ground: string;
  readonly inner: string;
  readonly marks: readonly [string, string, string];
}

// The gold the ancestors' line-work is drawn in.
const gold = new Color("#f6c453");

// A maridium jacket, as the book paints them: bold bands of triangles, chevrons and diamonds, each band edged in gold line-work. Round
// the body (`open` true) it hangs open down the front, over the shirt, the opening widening to the collar and edged in gold. Two
// pictures: the cloth, and its gold alone on black (which is what glows when the ancestors light the jackets).
export function jacketCloth(
  colours: JacketColours,
  open: boolean,
  seed: number,
): { readonly glow: DataTexture; readonly map: DataTexture } {
  const ground = new Color(colours.ground);
  const inner = new Color(colours.inner);
  const marks = colours.marks.map((mark) => new Color(mark));
  const random = noise(seed);
  const size = 256;
  const bands = 6;
  const cells = 8;
  // What is at a point: a colour, and whether it is gold line-work.
  const at = (u: number, v: number): readonly [Color, boolean] => {
    if (open) {
      const from = Math.abs(u - 0.25);
      const gap = 0.028 + smoothed(0.5, 1, v) * 0.075;
      if (from < gap) return [inner, false];
      if (from < gap + 0.014) return [gold, true];
    }
    const band = Math.floor(v * bands);
    const t = v * bands - band;
    if (t < 0.07 || t > 0.93) return [gold, true];
    const k = (u * cells) % 1;
    const first = marks[band % 3] ?? ground;
    const second = marks[(band + 1) % 3] ?? ground;
    if (band % 3 === 0) {
      // A row of triangles, point up and point down by turns.
      const up = Math.floor(u * cells) % 2 === 0;
      const inside = (up ? t : 1 - t) < 1 - Math.abs(k * 2 - 1);
      return [inside ? first : ground, false];
    }
    if (band % 3 === 1) {
      // Chevrons, nested.
      const stripe = ((t + Math.abs(k - 0.5) * 2) * 2.5) % 1;
      if (stripe > 0.46 && stripe < 0.54) return [gold, true];
      return [stripe < 0.5 ? second : ground, false];
    }
    // Diamonds, each with a gold heart.
    const d = Math.abs(k - 0.5) + Math.abs(t - 0.5);
    if (d < 0.12) return [gold, true];
    return [d < 0.42 ? first : d < 0.5 ? second : ground, false];
  };
  const paint = (glowing: boolean) =>
    texture(size, (x, y) => {
      const [colour, lit] = at((x + 0.5) / size, (y + 0.5) / size);
      if (glowing) return lit ? [255, 200, 92, 255] : [0, 0, 0, 255];
      return rgba(lit ? colour : weave(colour, x, y, random));
    });
  return { glow: paint(true), map: paint(false) };
}

const smoothed = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// What a shoe is made of.
export interface ShoeColours {
  readonly cap: string;
  readonly kind: "boot" | "flat" | "sneaker";
  readonly lace: string;
  readonly sole: string;
  readonly upper: string;
}

// A shoe's picture: round it is across the picture (the top of the foot at a quarter, the sole at three quarters), heel to toe is up
// it. A sneaker has a pale sole, a toe cap and laces; a boot a dark sole and laces; a flat is cut low over the top of the foot, where
// the skin shows.
export function shoeCloth(
  colours: ShoeColours,
  skin: string,
  seed: number,
): DataTexture {
  const paints = {
    cap: new Color(colours.cap),
    lace: new Color(colours.lace),
    skin: new Color(skin),
    sole: new Color(colours.sole),
    upper: new Color(colours.upper),
  };
  const random = noise(seed);
  const size = 64;
  return texture(size, (x, y) => {
    const high = Math.sin(((x + 0.5) / size) * Math.PI * 2);
    const v = (y + 0.5) / size;
    const laced = Math.floor(v * 28) % 2 === 0;
    const { kind } = colours;
    if (high < -0.5) return rgba(paints.sole);
    if (high < -0.42) return rgba(paints.sole.clone().multiplyScalar(0.6));
    if (kind === "sneaker" && v > 0.8 && high < 0.8) return rgba(paints.cap);
    if (kind !== "flat" && high > 0.7 && v > 0.3 && v < 0.64 && laced)
      return rgba(paints.lace);
    if (kind === "flat" && high > 0.2 && v > 0.16 && v < 0.64)
      return rgba(paints.skin);
    return rgba(weave(paints.upper, x, y, random));
  });
}
