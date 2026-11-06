import { stepInt, startState } from "@frostbite/game-sdk/seeded";

import { deltas } from "./constants.ts";

// A maze is a grid of cells; each cell holds a number whose bits say which of its four sides are open (bit d for direction d, as in
// `directions`). It is carved from a seed, so the same seed always gives the same maze, and every cell can be reached from every other.
export interface Maze {
  readonly height: number;
  // For each cell (row by row), the sides that are open.
  readonly open: readonly number[];
  readonly width: number;
}

export const bitOf = (direction: number): number => 1 << direction;
const at = (list: readonly number[], index: number): number => list[index] ?? 0;

// The cell a step from `cell` in `direction` lands on, or -1 if that is off the grid.
export function neighbour(
  width: number,
  height: number,
  cell: number,
  direction: number,
): number {
  const delta = deltas[direction];
  if (delta === undefined) return -1;
  const x = (cell % width) + delta.x;
  const y = Math.floor(cell / width) + delta.y;
  return x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x;
}

export const opposite = (direction: number): number => (direction + 2) % 4;

// Carves a maze by walking the grid depth first (every cell is reached once, so there is exactly one way between any two cells), then
// opens `loops` more walls so some ways have two routes.
export function carve(
  seed: number,
  width: number,
  height: number,
  loops: number,
): Maze {
  const open = new Array<number>(width * height).fill(0);
  const seen = new Array<boolean>(width * height).fill(false);
  let state = startState(seed);
  const pick = (below: number): number => {
    const stepped = stepInt(state, below);
    state = stepped.state;
    return stepped.value;
  };
  const join = (cell: number, direction: number, other: number): void => {
    open[cell] = at(open, cell) | bitOf(direction);
    open[other] = at(open, other) | bitOf(opposite(direction));
  };
  const trail = [0];
  seen[0] = true;
  for (let top = trail.at(-1); top !== undefined; top = trail.at(-1)) {
    const options: number[] = [];
    for (let direction = 0; direction < 4; direction += 1) {
      const other = neighbour(width, height, top, direction);
      if (other >= 0 && seen[other] !== true) options.push(direction);
    }
    const direction = options[pick(options.length)];
    if (direction === undefined) {
      trail.pop();
      continue;
    }
    const other = neighbour(width, height, top, direction);
    seen[other] = true;
    join(top, direction, other);
    trail.push(other);
  }
  for (let made = 0; made < loops; made += 1) {
    const cell = pick(width * height);
    const direction = pick(4);
    const other = neighbour(width, height, cell, direction);
    if (other >= 0) join(cell, direction, other);
  }
  return { height, open, width };
}

// How many steps each cell is from `from` along the open sides (-1 where it cannot be reached, which a carved maze never has).
export function distances(maze: Maze, from: number): readonly number[] {
  const far = new Array<number>(maze.width * maze.height).fill(-1);
  far[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head] ?? 0;
    for (let direction = 0; direction < 4; direction += 1) {
      if ((at(maze.open, cell) & bitOf(direction)) === 0) continue;
      const other = neighbour(maze.width, maze.height, cell, direction);
      if (other < 0 || at(far, other) >= 0) continue;
      far[other] = at(far, cell) + 1;
      queue.push(other);
    }
  }
  return far;
}

// The number of open sides of a cell.
export const sidesOpen = (maze: Maze, cell: number): number =>
  [0, 1, 2, 3].filter(
    (direction) => (at(maze.open, cell) & bitOf(direction)) !== 0,
  ).length;

export const cellOpen = (
  maze: Maze,
  cell: number,
  direction: number,
): boolean => (at(maze.open, cell) & bitOf(direction)) !== 0;
