import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { ambient, scenes, snowfall } from "../../src/library/index.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(snowfall);
const flakes = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour }) =>
        colour === palette.starDim ||
        colour === palette.starBright ||
        colour === palette.white,
    );

describe("snowfall", () => {
  it("is weather for a page: held to the scene tests, but never in the list a person picks from", () => {
    expect(ambient).toContain(snowfall);
    expect(scenes).not.toContain(snowfall);
  });

  it("drops 90 flakes in three layers, the nearest biggest and brightest", () => {
    expect(flakes(0)).toHaveLength(90);
    const sizes = (colour: string) => [
      ...new Set(
        flakes(0)
          .filter((flake) => flake.colour === colour)
          .map(({ width }) => width),
      ),
    ];
    expect(sizes(palette.starDim)).toEqual([1]);
    expect(sizes(palette.white)).toEqual([2]);
  });

  it("lets the snow fall: every flake is lower a moment later, wrapping at the bottom", () => {
    const before = flakes(1);
    const after = flakes(1.5);
    const fell = before.filter((flake, at) => (after[at]?.y ?? 0) !== flake.y);
    expect(fell).toHaveLength(before.length);
    const lower = before.filter((flake, at) => (after[at]?.y ?? 0) > flake.y);
    // Nearly all go down; only the few that cross the bottom edge in that half second come back round to the top.
    expect(lower.length).toBeGreaterThan(before.length * 0.8);
  });

  it("falls faster in front than behind", () => {
    const speed = (colour: string) => {
      const a = flakes(2).filter((flake) => flake.colour === colour);
      const b = flakes(2.2).filter((flake) => flake.colour === colour);
      const moved = a.map((flake, at) => ((b[at]?.y ?? 0) - flake.y + 90) % 90);
      return moved.reduce((sum, value) => sum + value, 0) / moved.length;
    };
    expect(speed(palette.white)).toBeGreaterThan(speed(palette.starBright));
    expect(speed(palette.starBright)).toBeGreaterThan(speed(palette.starDim));
  });

  it("keeps an icy range under the sky, with a pale edge along its top", () => {
    const lit = frames
      .at(0)
      .filter(({ colour, height }) => colour === palette.cloud && height === 1);
    expect(lit.length).toBeGreaterThan(70);
  });
});
