// Directions and the whole-number arithmetic the rules move by. A way is one of sixteen, clockwise from north (away from the camera);
// each is a step of about a thousand millimetres, written out so no engine ever computes a sine.
export const ways: readonly (readonly [number, number])[] = [
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

// Thirty-two points around a circle, for where snowballs and darts come from.
export const rim: readonly (readonly [number, number])[] = [
  [0, -1000],
  [195, -981],
  [383, -924],
  [556, -831],
  [707, -707],
  [831, -556],
  [924, -383],
  [981, -195],
  [1000, 0],
  [981, 195],
  [924, 383],
  [831, 556],
  [707, 707],
  [556, 831],
  [383, 924],
  [195, 981],
  [0, 1000],
  [-195, 981],
  [-383, 924],
  [-556, 831],
  [-707, 707],
  [-831, 556],
  [-924, 383],
  [-981, 195],
  [-1000, 0],
  [-981, -195],
  [-924, -383],
  [-831, -556],
  [-707, -707],
  [-556, -831],
  [-383, -924],
  [-195, -981],
];

// Whole-number division toward zero.
export const div = (a: number, b: number): number => Math.trunc(a / b);

// The whole-number square root (floor). A square root is correctly rounded on every engine, so this is the same everywhere.
export const isqrt = (n: number): number =>
  n <= 0 ? 0 : Math.floor(Math.sqrt(n));

export const length = (x: number, y: number): number => isqrt(x * x + y * y);

// A step of `speed` millimetres from (x, y) toward (tx, ty): the result is a velocity.
export const toward = (
  x: number,
  y: number,
  tx: number,
  ty: number,
  speed: number,
): [number, number] => {
  const dx = tx - x;
  const dy = ty - y;
  const d = length(dx, dy);
  if (d === 0) return [0, speed];
  return [div(dx * speed, d), div(dy * speed, d)];
};

// The nearest of the sixteen ways to a direction (a velocity), by the largest dot product: no angles needed.
export const nearestWay = (
  dx: number,
  dy: number,
  fallback: number,
): number => {
  if (dx === 0 && dy === 0) return fallback;
  let best = fallback;
  let bestDot = -Infinity;
  for (let k = 0; k < ways.length; k += 1) {
    const way = ways[k];
    if (way === undefined) continue;
    const dot = way[0] * dx + way[1] * dy;
    if (dot > bestDot) {
      bestDot = dot;
      best = k;
    }
  }
  return best;
};

export const stepOf = (way: number): readonly [number, number] =>
  ways[way] ?? [0, 0];
export const rimAt = (index: number): readonly [number, number] =>
  rim[((index % rim.length) + rim.length) % rim.length] ?? [0, -1000];
