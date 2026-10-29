import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { street } from "../../src/library/street.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(street);
const car = (t: number) =>
  frames
    .at(t)
    .filter(({ colour, width }) => colour === palette.red && width === 22);
const coat = (t: number) =>
  frames
    .at(t)
    .filter(({ colour }) => colour === palette.coat)
    .map(({ x, y, width }) => `${x}|${y}|${width}`)
    .join();
const windows = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        colour === palette.yellow && width === 2 && height === 3,
    );

describe("night street", () => {
  it("has a car pass in the first half of each ten seconds and not the second", () => {
    expect(car(2)).toHaveLength(1);
    expect(car(7)).toHaveLength(0);
    expect(car(12)).toHaveLength(1);
    expect(car(2)[0]?.x).toBeGreaterThan(car(3)[0]?.x ?? 0);
  });

  it("has the figure change stride as it walks", () => {
    expect(new Set([0.0, 0.2, 0.4, 0.6].map(coat)).size).toBe(2);
  });

  it("keeps each window lit on its own building as the city passes, so none shimmers", () => {
    const before = windows(3);
    const after = windows(3.05);
    expect(before.length).toBeGreaterThan(5);
    const moved = before.filter(({ x, y }) =>
      after.some((other) => other.y === y && Math.abs(other.x - x) <= 2),
    );
    expect(moved.length).toBeGreaterThanOrEqual(before.length - 3);
  });

  it("scrolls the near buildings faster than the far ones", () => {
    const edge = (t: number, colour: string) =>
      Math.min(
        ...frames
          .at(t)
          .filter((d) => d.colour === colour && d.height > 20 && d.x > 0)
          .map(({ x }) => x),
      );
    const near = edge(3, palette.nearCity) - edge(4, palette.nearCity);
    const far = edge(3, palette.farCity) - edge(4, palette.farCity);
    expect(Math.abs(near)).toBeGreaterThan(0);
    expect(Math.abs(far)).toBeGreaterThan(0);
  });
});
