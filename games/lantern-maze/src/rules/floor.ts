import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import {
  flaskPercent,
  firstGrantPercent,
  firstHeight,
  firstWidth,
  grantPercentStep,
  leastFlask,
  leastGrantPercent,
  loopFloor,
  mostFlasks,
  mostLoopPercent,
  sightByFloor,
  tallestFloor,
  widestFloor,
} from "./constants.ts";
import { carve, distances, sidesOpen, type Maze } from "./maze.ts";

// One floor of the cellar: its maze, where the lantern starts (always the first cell), where the key lies, where the locked door is, and
// where the flasks of oil are. Everything is decided by the run's seed and the floor's number.
export interface Floor {
  readonly door: number;
  readonly flasks: readonly number[];
  readonly flaskValue: number;
  // The oil the lantern is given on coming down to this floor: its shortest route times a share that falls with the floor.
  readonly entry: number;
  readonly key: number;
  readonly maze: Maze;
  // The fewest steps from the start to the key and then to the door.
  readonly shortest: number;
  readonly sight: number;
}

export const widthOf = (floor: number): number =>
  Math.min(widestFloor, firstWidth + floor);
export const heightOf = (floor: number): number =>
  Math.min(tallestFloor, firstHeight + Math.ceil((3 * floor) / 5));
export const flasksOn = (floor: number): number =>
  Math.min(mostFlasks, 2 + Math.floor(floor / 5));
export const grantPercentOf = (floor: number): number =>
  Math.max(
    leastGrantPercent,
    firstGrantPercent - grantPercentStep * (floor - 1),
  );
export const sightOf = (floor: number): number =>
  sightByFloor.reduce(
    (sight, rung) => (floor >= rung.from ? rung.sight : sight),
    1,
  );
const loopsOf = (floor: number, cells: number): number =>
  Math.floor(
    (cells * Math.min(mostLoopPercent, Math.max(0, floor - loopFloor))) / 100,
  );

// Each floor has a seed of its own, so floors do not depend on how the earlier ones were played.
export const floorSeed = (seed: number, floor: number): number =>
  Math.imul((seed ^ Math.imul(floor, 0x9e37_79b1)) >>> 0, 0x85eb_ca6b) >>> 0;

const farthest = (
  far: readonly number[],
  skip: ReadonlySet<number>,
): number[] =>
  far
    .map((distance, cell) => ({ cell, distance }))
    .filter(({ cell }) => !skip.has(cell))
    .sort((a, b) => b.distance - a.distance || a.cell - b.cell)
    .map(({ cell }) => cell);

export function buildFloor(seed: number, floor: number): Floor {
  const width = widthOf(floor);
  const height = heightOf(floor);
  const made = floorSeed(seed, floor);
  const maze = carve(made, width, height, loopsOf(floor, width * height));
  let state = startState(made ^ 0x5bd1_e995);
  const pick = (below: number): number => {
    const stepped = stepInt(state, below);
    state = stepped.state;
    return stepped.value;
  };
  const fromStart = distances(maze, 0);
  // The key lies at the end of a blind alley, one of the three furthest from the start; the door is the cell furthest from the key.
  const alleys = farthest(fromStart, new Set([0])).filter(
    (cell) => sidesOpen(maze, cell) === 1,
  );
  const key = alleys[pick(Math.min(3, alleys.length))] ?? alleys[0] ?? 1;
  const fromKey = distances(maze, key);
  const door = farthest(fromKey, new Set([key]))[0] ?? 0;
  const shortest = (fromStart[key] ?? 0) + (fromKey[door] ?? 0);
  // Flasks lie in blind alleys first, then in the cells with fewest ways out.
  const taken = new Set([0, key, door]);
  const rest = maze.open
    .map((_, cell) => cell)
    .filter((cell) => !taken.has(cell))
    .sort((a, b) => sidesOpen(maze, a) - sidesOpen(maze, b) || a - b);
  const wanted = flasksOn(floor);
  const pool = rest.slice(0, wanted * 3);
  const flasks: number[] = [];
  while (flasks.length < wanted && pool.length > 0) {
    const [chosen] = pool.splice(pick(pool.length), 1);
    if (chosen !== undefined) flasks.push(chosen);
  }
  return {
    door,
    flasks: flasks.sort((a, b) => a - b),
    flaskValue: Math.max(
      leastFlask,
      Math.ceil((shortest * flaskPercent) / 100),
    ),
    entry: Math.ceil((shortest * grantPercentOf(floor)) / 100),
    key,
    maze,
    shortest,
    sight: sightOf(floor),
  };
}
