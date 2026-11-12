// The raised stair to the kitchen's side door: six broad treads curving round from the front lawn, up to a landing at the door, and one
// step down inside. Where it is, and how high the ground is on it, for whoever walks it (the meadow's ground asks) and for the treads
// drawn on it (house-outside.ts).
export const treads = 6;
export const treadRise = 0.05;
export const stairWide = 1.7;
// The landing outside the door, and the step just inside it.
export const landing = {
  high: treads * treadRise,
  x0: -13.4,
  x1: -12.1,
  z0: 4.1,
  z1: 5.9,
};
export const inside = { high: 0.15, x0: -11.9, x1: -11.3, z0: 4.3, z1: 5.7 };

// The middle of the stair, `t` from the lawn (0) to the landing (1): a curve round the corner of the house.
export function stairLine(t: number): { x: number; z: number } {
  const [a, c, e] = [
    { x: -14.3, z: -0.8 },
    { x: -15.4, z: 4.4 },
    { x: -13.3, z: 5 },
  ];
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * e.x,
    z: u * u * a.z + 2 * u * t * c.z + t * t * e.z,
  };
}

const within = (
  x: number,
  z: number,
  box: { x0: number; x1: number; z0: number; z1: number },
): boolean => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;

// How high the stair lifts the ground at a place (0 off it).
export function stairAt(x: number, z: number): number {
  if (x > -11.2 || x < -16.4 || z < -2 || z > 6.2) return 0;
  if (within(x, z, inside)) return inside.high;
  if (within(x, z, landing)) return landing.high;
  let nearest = Number.POSITIVE_INFINITY;
  let at = 0;
  for (let step = 0; step <= 36; step += 1) {
    const point = stairLine(step / 36);
    const away = Math.hypot(point.x - x, point.z - z);
    if (away < nearest) {
      nearest = away;
      at = step / 36;
    }
  }
  if (nearest > stairWide / 2) return 0;
  return Math.min(treads, Math.floor(at * treads) + 1) * treadRise;
}
