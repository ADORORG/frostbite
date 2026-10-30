import { describe, expect, it } from "vitest";

import { lightAround, lit } from "../src/rules/light.ts";
import { carve, distances } from "../src/rules/maze.ts";

describe("the lantern's light", () => {
  it("reaches exactly the cells within `sight` steps along the passages, and tells how far each is", () => {
    for (const seed of [1, 2, 3, 4]) {
      const maze = carve(seed, 9, 6, seed);
      const far = distances(maze, 10);
      for (const sight of [0, 1, 2, 3, 4]) {
        const reach = lit(maze, 10, sight);
        const expected = far.flatMap((steps, cell) =>
          steps >= 0 && steps <= sight ? [[cell, steps] as const] : [],
        );
        expect([...reach.entries()].sort((a, b) => a[0] - b[0])).toEqual(
          expected,
        );
      }
    }
  });

  it("adds what it lights to what was seen before, and keeps the rest", () => {
    const maze = carve(5, 6, 4, 0);
    const before = Array.from({ length: 24 }, (_, cell) => cell === 23);
    const after = lightAround(maze, before, 0, 2);
    expect(after[23]).toBe(true);
    expect(after[0]).toBe(true);
    expect(after.filter(Boolean).length).toBe(
      lit(maze, 0, 2).size + (lit(maze, 0, 2).has(23) ? 0 : 1),
    );
    expect(before.filter(Boolean)).toHaveLength(1);
  });
});
