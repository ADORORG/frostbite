import { colour, kindColours } from "./palette.ts";

// A bit of confetti: where it starts (screen pixels), how fast it goes, and its colour. Its place at a frame is worked out from these alone, so
// the same pop always looks the same and nothing is stored between frames.
export interface Particle {
  readonly fill: string;
  readonly vx: number;
  readonly vy: number;
  readonly x: number;
  readonly y: number;
}

const gravity = 0.09;
export const life = 26;

// A small hash of two numbers into a whole number, for scattering particles the same way every time.
const hash = (a: number, b: number): number =>
  Math.imul(
    (Math.imul(a + 1, 0x9e37_79b1) ^ Math.imul(b + 7, 0x85eb_ca6b)) >>> 0,
    0x27d4_eb2d,
  ) >>> 0;

// `count` particles from the centre of a cell, in the colour of its kind (or ice, for a frost that broke).
export function burst(
  x: number,
  y: number,
  kind: number | "ice",
  seed: number,
  count = 6,
): readonly Particle[] {
  const fill = kind === "ice" ? "#d8f4ff" : (kindColours[kind] ?? colour.white);
  return Array.from({ length: count }, (_, at) => {
    const h = hash(seed, at);
    const angle = (h % 360) * (Math.PI / 180);
    const speed = 0.5 + ((h >>> 9) % 100) / 90;
    return {
      fill,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      x,
      y,
    };
  });
}

// Where a particle is `age` frames on, or null once it is gone.
export function placeOf(
  particle: Particle,
  age: number,
): { readonly x: number; readonly y: number } | null {
  if (age < 0 || age >= life) return null;
  return {
    x: particle.x + particle.vx * age,
    y: particle.y + particle.vy * age + gravity * age * age,
  };
}
