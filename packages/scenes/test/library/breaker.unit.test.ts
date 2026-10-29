import { describe, expect, it } from "vitest";

import { palette, sceneWidth } from "../../src/engine/index.ts";
import { breaker } from "../../src/library/breaker.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(breaker);
const wall = new Set<string>([
  palette.red,
  palette.yellow,
  palette.green,
  palette.cyan,
]);
const bricks = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width, y }) =>
        wall.has(colour) && width === 13 && height === 5 && y < 40,
    ).length;
const ball = (t: number) =>
  frames
    .at(t)
    .find(
      ({ colour, height, width }) =>
        colour === palette.yellow && width === 3 && height === 3,
    );
const paddle = (t: number) =>
  frames
    .at(t)
    .find(
      ({ colour, height, width }) =>
        colour === palette.white && width === 20 && height === 3,
    );

describe("brick breaker", () => {
  it("starts with the whole wall, and the ball resting on the paddle in the middle", () => {
    expect(bricks(0)).toBe(40);
    expect(paddle(0)?.x).toBe(70);
    expect(ball(0)?.x).toBeCloseTo(80, 0);
  });

  it("loses bricks as it goes and gets them all back before the loop closes", () => {
    const counts = Array.from(
      { length: Math.floor(frames.loopSeconds) },
      (_, at) => bricks(at),
    );
    expect(Math.min(...counts)).toBeLessThan(40);
    expect(bricks(frames.loopSeconds - 1e-6)).toBe(40);
    expect(
      counts.some((count, at) => at > 0 && count < (counts[at - 1] ?? 0)),
    ).toBe(true);
  });

  it("keeps the ball and the paddle inside the picture all the while", () => {
    for (let t = 0; t < frames.loopSeconds; t += 0.1) {
      const b = ball(t);
      const p = paddle(t);
      expect(b?.x).toBeGreaterThanOrEqual(0);
      expect((b?.x ?? 0) + 3).toBeLessThanOrEqual(sceneWidth + 1);
      expect(p?.x).toBeGreaterThanOrEqual(0);
      expect((p?.x ?? 0) + 20).toBeLessThanOrEqual(sceneWidth);
    }
  });

  it("keeps the paddle under the ball as it plays", () => {
    const apart: number[] = [];
    for (let t = 1; t < 15; t += 0.25)
      apart.push(Math.abs((paddle(t)?.x ?? 0) + 10 - ((ball(t)?.x ?? 0) + 1)));
    expect(Math.max(...apart)).toBeLessThan(25);
    expect(apart.filter((gap) => gap < 12).length).toBeGreaterThan(
      apart.length / 2,
    );
  });

  it("sends the ball off the paddle at different slants, so the play is not a fixed zigzag", () => {
    const slants = new Set<number>();
    for (let step = 1; step < 60 * 20; step += 1) {
      const a = ball((step - 1) / 60);
      const b = ball(step / 60);
      slants.add(Math.round(Math.abs((b?.x ?? 0) - (a?.x ?? 0)) * 4));
    }
    expect(slants.size).toBeGreaterThan(3);
  });

  it("flashes a brick as the ball breaks it", () => {
    let flashes = 0;
    for (let t = 0; t < frames.loopSeconds; t += 1 / 60)
      if (
        frames
          .at(t)
          .some(({ colour, width }) => colour === palette.white && width === 10)
      )
        flashes += 1;
    expect(flashes).toBeGreaterThan(10);
  });

  it("brings the paddle back to the middle once the wall is clear", () => {
    const end = frames.loopSeconds - 0.01;
    expect(paddle(end)?.x).toBeCloseTo(70, 0);
  });
});
