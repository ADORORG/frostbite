import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { runner } from "../../src/library/runner.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(runner);
const heroTop = (t: number) =>
  Math.min(
    ...frames
      .at(t)
      .filter(
        ({ colour, height, width }) =>
          colour === palette.cyan && width >= 1 && height === 1,
      )
      .map(({ y }) => y),
  );
const obstacles = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        colour === palette.red && width === 8 && height === 8,
    );

describe("side runner", () => {
  it("keeps the hero on the ground between obstacles and lifts it over one", () => {
    const ground = heroTop(0.5);
    expect(heroTop(2.5)).toBeLessThan(ground - 10);
    expect(heroTop(4.7)).toBeLessThan(ground - 10);
    expect(heroTop(3.6)).toBe(ground);
  });

  it("brings obstacles in from the right at the speed of the ground", () => {
    expect(obstacles(1)[0]?.x).toBeGreaterThan(obstacles(1.5)[0]?.x ?? 0);
    // Half a second at 55 pixels a second, to the nearest pixel.
    const moved = (obstacles(1)[0]?.x ?? 0) - (obstacles(1.5)[0]?.x ?? 0);
    expect(Math.abs(moved - 27.5)).toBeLessThanOrEqual(1);
  });

  it("scatters coins that are gathered along the way", () => {
    expect(
      frames
        .at(1)
        .some(({ colour, width }) => colour === palette.yellow && width === 3),
    ).toBe(true);
  });
});
