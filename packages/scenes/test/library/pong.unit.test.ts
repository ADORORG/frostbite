import { describe, expect, it } from "vitest";

import { palette, sceneHeight, sceneWidth } from "../../src/engine/index.ts";
import { pong } from "../../src/library/pong.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(pong);
const ball = (t: number) =>
  frames
    .at(t)
    .find(
      ({ colour, height, width }) =>
        colour === palette.white && width === 3 && height === 3,
    );
const left = (t: number) =>
  frames
    .at(t)
    .find(({ colour, width }) => colour === palette.cyan && width === 3);
const right = (t: number) =>
  frames
    .at(t)
    .find(({ colour, width }) => colour === palette.pink && width === 3);

describe("pong duel", () => {
  it("keeps the ball between the paddles and inside the picture, bouncing off both ends and both sides", () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let t = 0; t < frames.loopSeconds; t += 0.05) {
      const b = ball(t);
      xs.push(b?.x ?? -1);
      ys.push(b?.y ?? -1);
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(11);
    expect(Math.max(...xs)).toBeLessThanOrEqual(sceneWidth - 11 - 3);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(sceneHeight - 2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(60);
  });

  it("has both paddles follow the ball up and down, never leaving the picture", () => {
    for (let t = 0; t < frames.loopSeconds; t += 0.2) {
      for (const paddle of [left(t), right(t)]) {
        expect(paddle?.y).toBeGreaterThanOrEqual(0);
        expect((paddle?.y ?? 0) + 14).toBeLessThanOrEqual(sceneHeight);
      }
    }
    const ys = Array.from({ length: 60 }, (_, at) => left(at * 0.2)?.y ?? 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(30);
  });

  it("has the paddles a beat behind the ball, not glued to it", () => {
    let widest = 0;
    for (let t = 0; t < frames.loopSeconds; t += 0.05)
      widest = Math.max(
        widest,
        Math.abs((left(t)?.y ?? 0) + 7 - ((ball(t)?.y ?? 0) + 1.5)),
      );
    expect(widest).toBeGreaterThan(4);
    expect(widest).toBeLessThan(25);
  });

  it("leaves a trail behind the ball", () => {
    expect(
      frames
        .at(3)
        .filter(
          ({ colour, height, width }) =>
            (colour === palette.purple || colour === palette.deeper) &&
            width === 3 &&
            height === 3,
        ).length,
    ).toBeGreaterThanOrEqual(5);
  });
});
