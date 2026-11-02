import { startState, stepInt } from "@ador/game-sdk/seeded";

import { sortedMotes, type Mote } from "../plasma.ts";
import {
  cell,
  charmCount,
  eggCount,
  open,
  partCount,
  size,
} from "./constants.ts";
import type { Place } from "./types.ts";

// What else is hidden in the woods once the maze and its stones, chests and lanterns are laid out: the launcher's parts and the eggs
// (on the paths, apart from one another), the secret charms (in dead ends where there are any left), metaplasma in every open cell, and
// all from the seed, after the maze, so the maze is the same as it was without them.
const steps = [1, -1, size, -size] as const;
const indexOf = (place: Place): number => place.y * size + place.x;

export interface Stash {
  readonly charms: readonly Place[];
  readonly eggs: readonly Place[];
  readonly motes: readonly Mote[];
  readonly parts: readonly Place[];
}

export function stashOf(
  seed: number,
  walls: readonly number[],
  taken: readonly Place[],
): Stash {
  let rng = startState(seed ^ 0x5eed_0004);
  const roll = (bound: number): number => {
    const rolled = stepInt(rng, bound);
    rng = rolled.state;
    return rolled.value;
  };
  const used = new Set(taken.map(indexOf));
  const opens = (index: number): number =>
    steps.filter((step) => walls[index + step] === open).length;
  const cells: Place[] = [];
  for (let y = 1; y < size - 1; y += 1)
    for (let x = 1; x < size - 1; x += 1)
      if (walls[y * size + x] === open && x + y > 2) cells.push({ x, y });
  // Takes `count` places from `pool` (or, when it runs dry, any open cell), each at least `apart` steps from the others where it can.
  const pick = (
    pool: readonly Place[],
    count: number,
    apart: number,
  ): Place[] => {
    const chosen: Place[] = [];
    for (let at = 0; at < count; at += 1) {
      const free = (list: readonly Place[], gap: number) =>
        list.filter(
          (p) =>
            !used.has(indexOf(p)) &&
            chosen.every(
              (q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) >= gap,
            ),
        );
      const fits =
        [apart, 0]
          .map((gap) => free(pool, gap))
          .find((list) => list.length > 0) ?? free(cells, 0);
      const place = fits[roll(Math.max(1, fits.length))] ?? { x: 1, y: 1 };
      chosen.push(place);
      used.add(indexOf(place));
    }
    return chosen;
  };
  const deadEnds = cells.filter((p) => opens(indexOf(p)) === 1);
  const paths = cells.filter((p) => opens(indexOf(p)) > 1);
  const charms = pick(deadEnds, charmCount, 4);
  const parts = pick(paths, partCount, 5);
  const eggs = pick(paths, eggCount, 2);
  const motes: Mote[] = [];
  for (const place of cells) {
    const x = place.x * cell + cell / 2;
    const y = place.y * cell + cell / 2;
    motes.push(
      { x: x - 70, y: y - 50 },
      { x: x + 70, y: y - 20 },
      { x, y: y + 70 },
    );
  }
  return { charms, eggs, motes: sortedMotes(motes), parts };
}
