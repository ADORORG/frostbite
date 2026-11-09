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
