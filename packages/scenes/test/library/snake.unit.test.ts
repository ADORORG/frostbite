import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { snake } from "../../src/library/snake.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(snake);
const body = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        (colour === palette.green ||
          colour === palette.turfAlt ||
          colour === palette.yellow) &&
        width === 4 &&
        height === 4,
    );
const head = (t: number) =>
  frames
    .at(t)
    .find(({ colour, width }) => colour === palette.yellow && width === 4);
const food = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        colour === palette.red && width === 3 && height === 3,
    );

describe("snake", () => {
  it("is fourteen cells long and keeps that length all the way round", () => {
    for (const t of [0.3, 2.2, 5.1, 8.4]) expect(body(t)).toHaveLength(14);
  });

  it("moves its head one cell at a time, round a closed track", () => {
    const a = head(1.0);
    const b = head(1.0 + 0.125);
    expect(
      Math.abs((a?.x ?? 0) - (b?.x ?? 0)) + Math.abs((a?.y ?? 0) - (b?.y ?? 0)),
    ).toBe(5);
  });

  it("eats the food it passes, and the food comes back later in the lap", () => {
    const counts = Array.from(
      { length: 100 },
      (_, at) => food(at * 0.1).length,
    );
    expect(Math.max(...counts)).toBeGreaterThan(Math.min(...counts));
    expect(
      counts.filter((count, at) => at > 0 && count > (counts[at - 1] ?? 0))
        .length,
    ).toBeGreaterThan(0);
    expect(
      counts.filter((count, at) => at > 0 && count < (counts[at - 1] ?? 0))
        .length,
    ).toBeGreaterThan(0);
  });
});
