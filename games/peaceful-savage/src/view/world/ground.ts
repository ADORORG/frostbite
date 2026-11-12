import { stairAt } from "./stair.ts";

// The ground of the meadow and the grass round the house: rolling ground (flat by the house and all round it, rising to the hill the
// giant snake rests under), the pond's bank and bed, and the stair to the side door. Everything that stands or walks outside asks here
// how high the ground is.
export function rolling(x: number, z: number): number {
  if (z > -0.5) return 0;
  const away = Math.min(1, (-z - 0.5) / 6);
  const hill = 2.4 * Math.exp(-((x * x) / 60 + ((z + 18) * (z + 18)) / 40));
  const roll =
    0.35 * Math.sin(x * 0.21) * Math.cos(z * 0.17) +
    0.25 * Math.sin((x + z) * 0.09);
  return away * (hill + roll + 0.2);
}

const eased = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// The still pond in the meadow (one of the rules' mirrors): where it lies, how far its water reaches either way, and its level. The
// ground is laid level round it for a bank and dips under it, so the water has a shore and whoever walks in wades.
export const pond = {
  deep: 2.1,
  level: rolling(-12, -14) - 0.03,
  wide: 2.9,
  x: -12,
  z: -14,
} as const;

export function groundAt(x: number, z: number): number {
  const ground = rolling(x, z) + stairAt(x, z);
  const from = Math.hypot((x - pond.x) / pond.wide, (z - pond.z) / pond.deep);
  if (from >= 1.5) return ground;
  const bank = ground + (pond.level + 0.015 - ground) * eased(1.5, 1.05, from);
  return bank - 0.115 * eased(0.78, 0.55, from);
}
