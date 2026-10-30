import { describe, expect, it } from "vitest";

import {
  carve,
  cellOpen,
  distances,
  neighbour,
  opposite,
  sidesOpen,
} from "../src/rules/maze.ts";

const cells = (width: number, height: number) => width * height;
// Every wall between two neighbouring cells that is open, counted once.
const passages = (maze: ReturnType<typeof carve>): number => {
  let found = 0;
  for (let cell = 0; cell < maze.open.length; cell += 1)
    for (const direction of [1, 2])
      if (cellOpen(maze, cell, direction)) found += 1;
  return found;
};

describe("a carved maze", () => {
  it("reaches every cell from the first, with exactly one way between two cells when it has no loops", () => {
    for (const seed of [1, 2, 3, 99, 4_000_000_000]) {
      const maze = carve(seed, 9, 6, 0);
      expect(distances(maze, 0).every((far) => far >= 0)).toBe(true);
      expect(passages(maze)).toBe(cells(9, 6) - 1);
    }
  });

  it("is the same for the same seed, and different for another", () => {
    expect(carve(7, 8, 8, 0)).toEqual(carve(7, 8, 8, 0));
    expect(carve(7, 8, 8, 0).open).not.toEqual(carve(8, 8, 8, 0).open);
  });

  it("opens both sides of every passage, and none out of the grid", () => {
    const maze = carve(5, 7, 5, 6);
    for (let cell = 0; cell < maze.open.length; cell += 1)
      for (let direction = 0; direction < 4; direction += 1) {
        const other = neighbour(7, 5, cell, direction);
        if (other < 0) expect(cellOpen(maze, cell, direction)).toBe(false);
        else
          expect(cellOpen(maze, cell, direction)).toBe(
            cellOpen(maze, other, opposite(direction)),
          );
      }
  });

  it("gets loops: more passages than the cells it has less one, never more than asked for", () => {
    const plain = passages(carve(3, 10, 8, 0));
    const looped = passages(carve(3, 10, 8, 12));
    expect(looped).toBeGreaterThan(plain);
    expect(looped).toBeLessThanOrEqual(plain + 12);
  });

  it("measures the steps along open sides, and counts the sides of a cell", () => {
    const maze = carve(11, 5, 5, 0);
    const far = distances(maze, 0);
    expect(far[0]).toBe(0);
    const next = [0, 1, 2, 3].find((direction) => cellOpen(maze, 0, direction));
    expect(far[neighbour(5, 5, 0, next ?? 0)]).toBe(1);
    expect(sidesOpen(maze, 0)).toBe(
      [0, 1, 2, 3].filter((d) => cellOpen(maze, 0, d)).length,
    );
    expect(
      [...maze.open.keys()].some((cell) => sidesOpen(maze, cell) === 1),
    ).toBe(true);
  });
});

describe("neighbours", () => {
  it("are the cell beside, and none off an edge or in a direction that does not exist", () => {
    expect(neighbour(4, 3, 5, 0)).toBe(1);
    expect(neighbour(4, 3, 5, 1)).toBe(6);
    expect(neighbour(4, 3, 5, 2)).toBe(9);
    expect(neighbour(4, 3, 5, 3)).toBe(4);
    expect(neighbour(4, 3, 0, 0)).toBe(-1);
    expect(neighbour(4, 3, 0, 3)).toBe(-1);
    expect(neighbour(4, 3, 11, 1)).toBe(-1);
    expect(neighbour(4, 3, 11, 2)).toBe(-1);
    expect(neighbour(4, 3, 3, 1)).toBe(-1);
    expect(neighbour(4, 3, 5, 7)).toBe(-1);
  });
});
