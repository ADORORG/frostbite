import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { birds } from "../../src/library/birds.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(birds);
const flying = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, y }) =>
        colour === palette.white && height === 1 && y < 60,
    );
const falling = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height }) => colour === palette.red && height === 1 && true,
    );
const crosshair = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        (colour === palette.red || colour === palette.yellow) &&
        ((width === 4 && height === 1) || (width === 1 && height === 4)),
    );

describe("bird hunt", () => {
  it("has birds crossing the sky, left to right", () => {
    const xs = (t: number) => Math.min(...flying(t).map(({ x }) => x));
    expect(flying(1).length).toBeGreaterThan(0);
    expect(xs(2)).toBeGreaterThan(xs(1));
  });

  it("shows a crosshair on a bird in the air, and none when every bird has gone", () => {
    expect(crosshair(1)).toHaveLength(4);
    const some = Array.from(
      { length: 140 },
      (_, at) => crosshair(at * 0.1).length,
    );
    expect(some.every((count) => count === 0 || count === 4)).toBe(true);
    expect(some.some((count) => count === 4)).toBe(true);
  });

  it("flashes when a bird is hit, then the bird falls straight down in red", () => {
    const hit = 0.62 * 7;
    const flash = (t: number) =>
      frames
        .at(t)
        .some(
          ({ colour, height, width }) =>
            colour === palette.shine && width === 7 && height === 7,
        );
    expect(flash(hit + 0.1)).toBe(true);
    expect(flash(hit + 1)).toBe(false);
    const dropped = (t: number) => Math.min(...falling(t).map(({ y }) => y));
    expect(dropped(hit + 0.8)).toBeGreaterThan(dropped(hit + 0.2));
  });

  it("beats its wings", () => {
    const wing = (t: number) =>
      flying(t)
        .map(({ width, y }) => `${width}|${y}`)
        .join();
    expect(new Set([0.2, 0.3, 0.4, 0.5].map(wing)).size).toBeGreaterThan(1);
  });
});
