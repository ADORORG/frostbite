import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { blocks } from "../../src/library/blocks.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(blocks);
const cellsIn = (t: number, row: number) =>
  frames
    .at(t)
    .filter(
      ({ height, width, y }) => width === 4 && height === 4 && y === row * 5,
    ).length;

describe("falling blocks", () => {
  it("starts with two rows filled but for the holes", () => {
    expect(cellsIn(0, 16)).toBe(2);
    expect(cellsIn(0, 17)).toBe(2);
  });

  it("fills every hole before the rows go: both rows are whole just before they flash", () => {
    expect(cellsIn(6.9, 16)).toBe(10);
    expect(cellsIn(6.9, 17)).toBe(10);
  });

  it("never puts two blocks in one place", () => {
    const places = frames
      .at(6.9)
      .filter(({ width }) => width === 4)
      .map(({ x, y }) => `${x},${y}`);
    expect(new Set(places).size).toBe(places.length);
  });

  it("flashes the rows white and then clears them, leaving an empty well", () => {
    const flash = frames
      .at(7.05)
      .filter(({ colour }) => colour === palette.white);
    expect(flash.some(({ width }) => width === 49)).toBe(true);
    expect(cellsIn(8.2, 16)).toBe(0);
    expect(cellsIn(8.2, 17)).toBe(0);
  });

  it("raises a fresh pair of rows for the next puzzle, with different holes", () => {
    const next = (t: number) =>
      frames.at(t).filter(({ width, y }) => width === 4 && y >= 80);
    expect(next(9.2).some(({ y }) => y > 80)).toBe(true);
    expect(cellsIn(9, 16)).toBe(2);
    expect(cellsIn(9, 17)).toBe(2);
    expect(cellsIn(9.0, 16)).toBe(cellsIn(0, 16));
  });

  it("lets the new rows rise from below the floor into place", () => {
    const stackTop = (t: number) =>
      Math.min(
        ...frames
          .at(t)
          .filter(
            ({ colour, width }) => colour === palette.ridge && width === 4,
          )
          .map(({ y }) => y),
      );
    expect(stackTop(8.8)).toBeGreaterThan(stackTop(9.2));
    expect(stackTop(17.8)).toBeGreaterThan(stackTop(0));
    expect(stackTop(9.2)).toBe(80);
  });

  it("drops a piece from above the well and lands it where the holes are", () => {
    const early = frames
      .at(0.9)
      .filter(({ colour }) => colour === palette.cyan);
    expect(early.length).toBeGreaterThan(0);
    expect(Math.min(...early.map(({ y }) => y))).toBeLessThan(70);
  });
});
