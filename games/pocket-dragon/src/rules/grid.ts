// A map of tiles walked one tile at a time (the castle's land, DeFu's woods and lair): the four ways, and the shortest way from one tile
// toward the nearest of some others (the first found, trying up, down, left, right), for whoever chases or carries.
export interface Spot {
  readonly x: number;
  readonly y: number;
}

export type Facing = "down" | "left" | "right" | "up";

export const ahead: Readonly<Record<Facing, Spot>> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

const ways: readonly Spot[] = [ahead.up, ahead.down, ahead.left, ahead.right];

// The first step from `from` toward the nearest tile `target` names, over tiles `open` allows, on a map `width` by `height`; null when
// none can be reached.
export function stepToward(
  width: number,
  height: number,
  from: Spot,
  target: (x: number, y: number) => boolean,
  open: (x: number, y: number) => boolean,
): Spot | null {
  const seen = new Uint8Array(width * height);
  const first = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const start = from.y * width + from.x;
  let head = 0;
  let tail = 1;
  queue[0] = start;
  seen[start] = 1;
  while (head < tail) {
    const at = queue[head] ?? start;
    head += 1;
    const x = at % width;
    const y = (at - x) / width;
    for (const way of ways) {
      const nx = x + way.x;
      const ny = y + way.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (seen[next] === 1) continue;
      seen[next] = 1;
      const step = at === start ? next : (first[at] ?? next);
      if (target(nx, ny))
        return { x: step % width, y: Math.floor(step / width) };
      if (!open(nx, ny)) continue;
      first[next] = step;
      queue[tail] = next;
      tail += 1;
    }
  }
  return null;
}
