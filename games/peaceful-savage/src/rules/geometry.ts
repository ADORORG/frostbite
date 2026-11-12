import { bodyRadius, type ZoneId } from "./constants.ts";

// The sixteen headings a body can face or walk, as steps of a thousand: 0 is north (toward the meadow), and they go round clockwise.
// They are written out, never worked out with sine, so every engine walks a body the same way.
export const headings: readonly (readonly [number, number])[] = [
  [0, -1000],
  [383, -924],
  [707, -707],
  [924, -383],
  [1000, 0],
  [924, 383],
  [707, 707],
  [383, 924],
  [0, 1000],
  [-383, 924],
  [-707, 707],
  [-924, 383],
  [-1000, 0],
  [-924, -383],
  [-707, -707],
  [-383, -924],
];

export const headingCount = headings.length;

// A box on the floor plan, from its north-west corner to its south-east one. Walls and furniture are boxes.
export interface Box {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

export interface Point {
  readonly x: number;
  readonly z: number;
}

export const box = (x0: number, z0: number, x1: number, z1: number): Box => ({
  x0,
  x1,
  z0,
  z1,
});

// Whether a body standing at a point would be inside a box.
export const hits = (point: Point, wall: Box, radius = bodyRadius): boolean =>
  point.x > wall.x0 - radius &&
  point.x < wall.x1 + radius &&
  point.z > wall.z0 - radius &&
  point.z < wall.z1 + radius;

export const blocked = (point: Point, walls: readonly Box[]): boolean =>
  walls.some((wall) => hits(point, wall));

const offset = (from: Point, heading: number, speed: number): Point => {
  const [hx, hz] = headings[(heading + headingCount) % headingCount] ?? [0, 0];
  return {
    x: from.x + Math.trunc((speed * hx) / 1000),
    z: from.z + Math.trunc((speed * hz) / 1000),
  };
};

// One step of `speed` toward a heading, sliding along a wall it meets: the whole step if it is clear, else only its east-west part, else
// only its north-south part, else a step a sixteenth of a turn to either side (which rounds a corner met head on), else none.
export function stepToward(
  from: Point,
  heading: number,
  speed: number,
  walls: readonly Box[],
): Point {
  const whole = offset(from, heading, speed);
  const tries: readonly Point[] = [
    whole,
    { x: whole.x, z: from.z },
    { x: from.x, z: whole.z },
    offset(from, heading - 1, speed),
    offset(from, heading + 1, speed),
  ];
  return (
    tries.find(
      (point) =>
        (point.x !== from.x || point.z !== from.z) && !blocked(point, walls),
    ) ?? from
  );
}

// The square of the distance between two points, in whole millimetres; compared with a reach squared, so no root is ever taken.
export const distanceSquared = (a: Point, b: Point): number =>
  (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);

// The whole square root of a whole number, rounded down: worked out with whole-number steps, so it is the same on every engine.
export function wholeRoot(value: number): number {
  if (value < 2) return Math.max(0, Math.floor(value));
  let root = value;
  let next = Math.floor((root + 1) / 2);
  while (next < root) {
    root = next;
    next = Math.floor((root + Math.floor(value / root)) / 2);
  }
  return root;
}

export const within = (a: Point, b: Point, reach: number): boolean =>
  distanceSquared(a, b) <= reach * reach;

// Which room a point is in. Outside the house, on any side, is the meadow; the hall runs down the middle; the kitchen and the children's room are
// to the west, the office and the parents' room to the east.
export function zoneAt(point: Point): ZoneId {
  if (point.z < 0 || point.z > 14_000 || Math.abs(point.x) > 12_000)
    return "meadow";
  if (point.x >= -3_000 && point.x <= 3_000) return "hall";
  if (point.x < -3_000) return point.z < 7_000 ? "kitchen" : "kids";
  return point.z < 7_000 ? "office" : "parents";
}

// The heading from one point to another, the nearest of the sixteen; used by the bots and by the page's compass, never by the rules'
// own judgement of a run.
export function headingTo(from: Point, to: Point): number {
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  headings.forEach(([hx, hz], index) => {
    const score = dx * hx + dz * hz;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
