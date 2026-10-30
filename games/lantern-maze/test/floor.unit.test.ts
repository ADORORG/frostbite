import { describe, expect, it } from "vitest";

import {
  buildFloor,
  flasksOn,
  floorSeed,
  grantPercentOf,
  heightOf,
  sightOf,
  widthOf,
} from "../src/rules/floor.ts";
import { distances, sidesOpen } from "../src/rules/maze.ts";

describe("the size and the stakes of a floor", () => {
  it("grows with the floor up to the most the screen holds", () => {
    expect([1, 2, 9, 10, 30].map(widthOf)).toEqual([7, 8, 15, 15, 15]);
    expect([1, 2, 5, 9, 30].map(heightOf)).toEqual([5, 6, 7, 9, 9]);
  });

  it("gives flasks from two to six, a shrinking share of oil, and a shortening light", () => {
    expect([1, 4, 5, 10, 20, 30, 99].map(flasksOn)).toEqual([
      2, 2, 3, 4, 6, 6, 6,
    ]);
    expect([1, 2, 12, 13, 30].map(grantPercentOf)).toEqual([
      112, 111, 101, 100, 100,
    ]);
    expect([1, 3, 4, 8, 9, 15, 16, 30].map(sightOf)).toEqual([
      4, 4, 3, 3, 2, 2, 1, 1,
    ]);
  });

  it("has a seed of its own for each floor", () => {
    const seeds = new Set([1, 2, 3, 4, 5].map((floor) => floorSeed(77, floor)));
    expect(seeds.size).toBe(5);
    expect(floorSeed(77, 3)).toBe(floorSeed(77, 3));
    expect(floorSeed(78, 3)).not.toBe(floorSeed(77, 3));
  });
});

describe("a floor", () => {
  it("is the same for the same seed and floor", () => {
    expect(buildFloor(5, 3)).toEqual(buildFloor(5, 3));
    expect(buildFloor(5, 3)).not.toEqual(buildFloor(5, 4));
  });

  it("puts the key in a blind alley away from the start, the door at the far end from the key, and a shortest route that adds up", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const floor = buildFloor(seed, 1 + (seed % 12));
      const { maze } = floor;
      expect(floor.key).not.toBe(0);
      expect(sidesOpen(maze, floor.key)).toBe(1);
      expect(floor.door).not.toBe(floor.key);
      const fromKey = distances(maze, floor.key);
      expect(fromKey[floor.door]).toBe(Math.max(...fromKey));
      expect(floor.shortest).toBe(
        (distances(maze, 0)[floor.key] ?? 0) + (fromKey[floor.door] ?? 0),
      );
      expect(floor.entry).toBe(
        Math.ceil((floor.shortest * grantPercentOf(1 + (seed % 12))) / 100),
      );
    }
  });

  it("scatters the wanted flasks over cells that are not the start, the key or the door, none twice", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const level = 1 + ((seed * 3) % 30);
      const floor = buildFloor(seed, level);
      expect(floor.flasks).toHaveLength(flasksOn(level));
      expect(new Set(floor.flasks).size).toBe(floor.flasks.length);
      for (const cell of floor.flasks)
        expect([0, floor.key, floor.door]).not.toContain(cell);
      expect([...floor.flasks].sort((a, b) => a - b)).toEqual(floor.flasks);
      expect(floor.flaskValue).toBeGreaterThanOrEqual(3);
      expect(floor.sight).toBe(sightOf(level));
    }
  });
});
