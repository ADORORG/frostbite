import { describe, expect, it } from "vitest";

import {
  barHeight,
  cell,
  lanternPoint,
  originOf,
  screenHeight,
  screenWidth,
  zoomOf,
  zoomStep,
} from "../src/screen/layout.ts";

describe("how large the maze is drawn", () => {
  it("is as large as the floor allows, in steps, and never smaller than a cell of eight", () => {
    expect(zoomOf(7, 5)).toBe(1.75);
    expect(zoomOf(15, 9)).toBe(1);
    expect(zoomOf(40, 30)).toBe(1);
    for (const [width, height] of [
      [7, 5],
      [9, 6],
      [11, 7],
      [13, 8],
      [15, 9],
    ] as const) {
      const zoom = zoomOf(width, height);
      expect(zoom % zoomStep).toBe(0);
      expect(zoom).toBeGreaterThanOrEqual(1);
      const origin = originOf(width, height);
      expect(origin.x).toBeGreaterThanOrEqual(0);
      expect(origin.y).toBeGreaterThanOrEqual(barHeight);
      expect(origin.x + width * cell * zoom).toBeLessThanOrEqual(screenWidth);
      expect(origin.y + height * cell * zoom).toBeLessThanOrEqual(screenHeight);
    }
  });

  it("grows a small floor to fill the height under the bar, since the height is what a wide screen runs out of", () => {
    const size = cell * zoomOf(7, 5);
    expect(5 * size).toBeGreaterThan((screenHeight - barHeight) * 0.8);
    expect(7 * size).toBeLessThan(screenWidth);
  });
});

describe("where the lantern is on the screen", () => {
  it("is the middle of its cell, counted along the row and then down the rows, with the width of a cell there", () => {
    const origin = originOf(7, 5);
    const size = cell * zoomOf(7, 5);
    expect(lanternPoint(7, 5, 0)).toEqual({
      size,
      x: origin.x + size / 2,
      y: origin.y + size / 2,
    });
    expect(lanternPoint(7, 5, 9)).toEqual({
      size,
      x: origin.x + 2 * size + size / 2,
      y: origin.y + size + size / 2,
    });
  });
});
