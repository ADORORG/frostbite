import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { racer } from "../../src/library/racer.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(racer);
const road = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height }) =>
        (colour === palette.road || colour === palette.roadAlt) && height === 1,
    );
const car = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, width }) =>
        colour === palette.yellow && width >= 4 && width <= 12,
    );

describe("retro racer", () => {
  it("draws the road wider the nearer it is, in perspective", () => {
    const rows = road(3).sort((a, b) => a.y - b.y);
    expect(rows.length).toBeGreaterThan(40);
    for (let at = 1; at < rows.length; at += 1)
      expect(rows[at]?.width ?? 0).toBeGreaterThanOrEqual(
        rows[at - 1]?.width ?? 0,
      );
    expect(rows.at(-1)?.width ?? 0).toBeGreaterThan(3 * (rows[0]?.width ?? 1));
  });

  it("bends the road one way and then the other over the loop", () => {
    const centre = (t: number) => {
      const far = road(t).sort((a, b) => a.y - b.y)[8];
      return (far?.x ?? 0) + (far?.width ?? 0) / 2;
    };
    expect(centre(5)).toBeGreaterThan(centre(10) + 5);
    expect(centre(15)).toBeLessThan(centre(10) - 5);
  });

  it("runs the stripes toward the player", () => {
    const stripe = (t: number) =>
      frames
        .at(t)
        .filter(
          ({ colour, height, width, y }) =>
            colour === palette.turf &&
            height === 1 &&
            width === 160 &&
            y === 60,
        ).length;
    expect(new Set([0.0, 0.05, 0.1, 0.15, 0.2, 0.25].map(stripe)).size).toBe(2);
  });

  it("sways the car from side to side", () => {
    const x = (t: number) => Math.min(...car(t).map((d) => d.x));
    expect(x(1.25)).not.toBe(x(3.75));
  });
});
