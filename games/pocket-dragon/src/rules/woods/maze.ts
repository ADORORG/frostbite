import { startState, stepSeed } from "@ador/game-sdk/seeded";

import { itemList } from "../kit.ts";
import {
  cell,
  chestCount,
  clueCount,
  frozen,
  gate,
  lanternCount,
  loops,
  open,
  size,
  tree,
} from "./constants.ts";
import { stashOf } from "./stash.ts";
import type { Place, WoodsLevel } from "./types.ts";

// The woods are laid out once from the seed: a maze of paths between trees (every path cell reachable from every other), a few extra
// openings so there is more than one way round, then the things to find. The moon gate is in the outer hedge, beside the path cell
// furthest from the start. The moon chest sits at the end of a dead end, behind a frozen hedge. Clue stones and chests go in other
// dead ends, lanterns along the paths, each a few cells from the others where the woods allow.
class Roller {
  state: number;
  constructor(seed: number) {
    this.state = startState(seed);
  }
  roll(bound: number): number {
    const step = stepSeed(this.state);
    this.state = step.state;
    return Math.floor(step.value * bound);
  }
}

export const indexOf = (x: number, y: number): number => y * size + x;
const steps = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

function carve(walls: number[], roller: Roller): void {
  const stack: Place[] = [{ x: 1, y: 1 }];
  walls[indexOf(1, 1)] = open;
  while (stack.length > 0) {
    const here = stack[stack.length - 1];
    if (here === undefined) break;
    const ways = steps.filter(([dx, dy]) => {
      const x = here.x + dx * 2;
      const y = here.y + dy * 2;
      return (
        x > 0 &&
        y > 0 &&
        x < size - 1 &&
        y < size - 1 &&
        walls[indexOf(x, y)] === tree
      );
    });
    if (ways.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dy] = ways[roller.roll(ways.length)] ?? [1, 0];
    walls[indexOf(here.x + dx, here.y + dy)] = open;
    walls[indexOf(here.x + dx * 2, here.y + dy * 2)] = open;
    stack.push({ x: here.x + dx * 2, y: here.y + dy * 2 });
  }
}

const openAround = (
  walls: readonly number[],
  x: number,
  y: number,
): readonly Place[] =>
  steps
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((p) => walls[indexOf(p.x, p.y)] === open);

// How many steps each cell is from the start, along the paths (-1 for a tree).
export function distances(
  walls: readonly number[],
  from: Place,
): readonly number[] {
  const far = walls.map(() => -1);
  far[indexOf(from.x, from.y)] = 0;
  const queue: Place[] = [from];
  for (let at = 0; at < queue.length; at += 1) {
    const here = queue[at];
    if (here === undefined) continue;
    const d = far[indexOf(here.x, here.y)] ?? 0;
    for (const next of openAround(walls, here.x, here.y))
      if (far[indexOf(next.x, next.y)] === -1) {
        far[indexOf(next.x, next.y)] = d + 1;
        queue.push(next);
      }
  }
  return far;
}

const apart = (
  a: Place,
  chosen: readonly Place[],
  gapAtLeast: number,
): boolean =>
  chosen.every((b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= gapAtLeast);

function choose(pool: Place[], chosen: Place[], roller: Roller): Place {
  for (const gapAtLeast of [6, 4, 2, 0]) {
    const fits = pool.filter((p) => apart(p, chosen, gapAtLeast));
    if (fits.length > 0) {
      const picked = fits[roller.roll(fits.length)] ?? { x: 1, y: 1 };
      pool.splice(pool.indexOf(picked), 1);
      chosen.push(picked);
      return picked;
    }
  }
  return { x: 1, y: 1 };
}

export function generateWoods(seed: number): WoodsLevel {
  const roller = new Roller(seed ^ 0x5eed_0002);
  const walls: number[] = Array.from({ length: size * size }, () => tree);
  carve(walls, roller);
  const start = { x: 1, y: 1 };
  const rooms: Place[] = [];
  for (let y = 1; y < size - 1; y += 2)
    for (let x = 1; x < size - 1; x += 2) if (x + y > 2) rooms.push({ x, y });
  // The moon chest's dead end is chosen while the maze is still a tree (which always has dead ends), a few steps from the start so its
  // frozen hedge never shuts Glitchy in; the extra openings then leave it alone.
  const carved = distances(walls, start);
  const deadEnds = rooms.filter(
    (p) => openAround(walls, p.x, p.y).length === 1,
  );
  const farEnds = deadEnds.filter((p) => (carved[indexOf(p.x, p.y)] ?? 0) >= 4);
  const moonChest = choose(farEnds.length > 0 ? farEnds : deadEnds, [], roller);
  const besideChest = (x: number, y: number): boolean =>
    Math.abs(x - moonChest.x) + Math.abs(y - moonChest.y) === 1;
  for (let made = 0, tries = 0; made < loops && tries < 400; tries += 1) {
    const x = 1 + roller.roll(size - 2);
    const y = 1 + roller.roll(size - 2);
    const across = x % 2 === 0 && y % 2 === 1;
    const down = x % 2 === 1 && y % 2 === 0;
    if (
      (across || down) &&
      walls[indexOf(x, y)] === tree &&
      !besideChest(x, y)
    ) {
      walls[indexOf(x, y)] = open;
      made += 1;
    }
  }
  const far = distances(walls, start);
  const isChest = (p: Place): boolean =>
    p.x === moonChest.x && p.y === moonChest.y;
  const ends = rooms.filter(
    (p) => openAround(walls, p.x, p.y).length === 1 && !isChest(p),
  );
  const paths = rooms.filter((p) => openAround(walls, p.x, p.y).length > 1);
  const edge = rooms.filter(
    (p) =>
      (p.x === 1 || p.y === 1 || p.x === size - 2 || p.y === size - 2) &&
      !isChest(p),
  );
  const exit = edge.reduce(
    (best, p) =>
      (far[indexOf(p.x, p.y)] ?? 0) > (far[indexOf(best.x, best.y)] ?? 0)
        ? p
        : best,
    start,
  );
  const out =
    exit.x === size - 2
      ? { x: size - 1, y: exit.y }
      : exit.y === size - 2
        ? { x: exit.x, y: size - 1 }
        : exit.x === 1
          ? { x: 0, y: exit.y }
          : { x: exit.x, y: 0 };
  walls[indexOf(out.x, out.y)] = gate;
  const chosen: Place[] = [exit, moonChest];
  const pool = ends.filter((p) => p.x !== exit.x || p.y !== exit.y);
  const [door] = openAround(walls, moonChest.x, moonChest.y);
  const frozenAt =
    door === undefined
      ? indexOf(moonChest.x, moonChest.y)
      : indexOf(door.x, door.y);
  walls[frozenAt] = frozen;
  const clues = Array.from({ length: clueCount }, () =>
    choose(pool.length > 0 ? pool : paths, chosen, roller),
  );
  const chests = Array.from({ length: chestCount }, () =>
    choose(pool.length > 0 ? pool : paths, chosen, roller),
  );
  const lanterns = Array.from({ length: lanternCount }, () =>
    choose(paths, chosen, roller),
  );
  const angle = walls[indexOf(2, 1)] === open ? 0 : 256;
  const stash = stashOf(seed, walls, [
    start,
    exit,
    moonChest,
    ...clues,
    ...chests,
    ...lanterns,
  ]);
  // The backpack's foods go in rooms left over, apart from the rest, from a seed of their own so nothing else moves for them.
  const placed = [
    start,
    exit,
    moonChest,
    ...clues,
    ...chests,
    ...lanterns,
    ...stash.parts,
    ...stash.eggs,
    ...stash.charms,
  ];
  const free = rooms.filter(
    (p) => !placed.some((q) => q.x === p.x && q.y === p.y),
  );
  const kitRoller = new Roller(seed ^ 0x5eed_0006);
  const kit = itemList.map((item) => ({
    item,
    ...choose(free, placed, kitRoller),
  }));
  return {
    ...stash,
    chests,
    clues,
    frozen: frozenAt,
    gate: indexOf(out.x, out.y),
    kit,
    lanterns,
    moonChest,
    start: { angle, x: cell + cell / 2, y: cell + cell / 2 },
    walls,
  };
}
