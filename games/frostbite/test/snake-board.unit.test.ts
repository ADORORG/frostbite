import { describe, expect, it } from "vitest";

import {
  cellCount,
  clearRowsEitherSide,
  foodGenerator,
  gridSize,
  holds,
  isOpposite,
  mineCount,
  nextHead,
  placeFood,
  placeMines,
  startRow,
  startingSnake,
  type Cell,
} from "../src/verifier/snake-board.ts";
import { seeded, startState, stepSeed } from "../src/verifier/seeded.ts";

describe("snake board", () => {
  it("wraps off every edge to the opposite side", () => {
    expect(nextHead([11, 3], "right")).toEqual([0, 3]);
    expect(nextHead([0, 3], "left")).toEqual([11, 3]);
    expect(nextHead([4, 0], "up")).toEqual([4, 11]);
    expect(nextHead([4, 11], "down")).toEqual([4, 0]);
    expect(nextHead([4, 4], "right")).toEqual([5, 4]);
  });

  it("knows which direction turns back on which", () => {
    expect(isOpposite("up", "down")).toBe(true);
    expect(isOpposite("left", "right")).toBe(true);
    expect(isOpposite("up", "left")).toBe(false);
    expect(isOpposite("up", "up")).toBe(false);
  });

  it("places the same mines for a seed, in cells of the board, keeping the rows around the start clear", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const mines = placeMines(seed);
      expect(mines).toEqual(placeMines(seed));
      expect(mines.length).toBeLessThanOrEqual(mineCount);
      expect(new Set(mines.map((cell) => cell.join())).size).toBe(mines.length);
      for (const [x, y] of mines) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(gridSize);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(gridSize);
        expect(Math.abs(y - startRow)).toBeGreaterThan(clearRowsEitherSide);
      }
    }
    expect(placeMines(1)).not.toEqual(placeMines(2));
  });

  it("starts in the clear row, heading right, three long", () => {
    expect(startingSnake).toEqual([
      [6, 6],
      [5, 6],
      [4, 6],
    ]);
  });

  it("puts food on a free cell, never on the snake or a mine, and moves the generator on", () => {
    const mines: Cell[] = [
      [0, 0],
      [1, 0],
    ];
    for (let seed = 0; seed < 100; seed += 1) {
      const food = placeFood(foodGenerator(seed), startingSnake, mines);
      expect(food.cell).not.toBeNull();
      if (food.cell === null) continue;
      expect(holds(startingSnake, food.cell)).toBe(false);
      expect(holds(mines, food.cell)).toBe(false);
      expect(food.generator).not.toBe(foodGenerator(seed));
    }
    expect(placeFood(5, startingSnake, mines)).toEqual(
      placeFood(5, startingSnake, mines),
    );
  });

  it("draws food from a stream of its own, not the one that laid the mines", () => {
    for (let seed = 0; seed < 50; seed += 1)
      expect(foodGenerator(seed)).not.toBe(startState(seed));
  });

  it("puts no food down when the snake and the mines hold every cell", () => {
    const cells: Cell[] = Array.from({ length: cellCount }, (_, i) => [
      i % gridSize,
      Math.floor(i / gridSize),
    ]);
    const full = placeFood(7, cells.slice(0, 100), cells.slice(100));
    expect(full.cell).toBeNull();
  });

  it("leaves exactly one free cell for the food to take", () => {
    const cells: Cell[] = Array.from({ length: cellCount }, (_, i) => [
      i % gridSize,
      Math.floor(i / gridSize),
    ]);
    expect(placeFood(9, cells.slice(1), []).cell).toEqual([0, 0]);
  });
});

describe("seeded generator steps", () => {
  it("gives what the closure form gives, from the state the caller keeps", () => {
    const next = seeded(42);
    let state = startState(42);
    for (let draw = 0; draw < 5; draw += 1) {
      const step = stepSeed(state);
      state = step.state;
      expect(step.value).toBe(next());
    }
  });

  it("starts a zero seed from a constant instead of a fixed point", () => {
    expect(startState(0)).toBe(3);
    expect(startState(7)).toBe(7);
    expect(stepSeed(startState(0)).value).not.toBe(0);
  });
});
