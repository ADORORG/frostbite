import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { shooter } from "../../src/library/shooter.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(shooter);
const invaderColours: readonly string[] = [
  palette.green,
  palette.cyan,
  palette.pink,
];
const burstColours: readonly string[] = [palette.yellow, palette.red];
// Invaders are drawn a row at a time in their own colours; counting those rows counts how much of the formation is there.
const invaders = (t: number) =>
  frames
    .at(t)
    .filter(({ colour, y }) => invaderColours.includes(colour) && y < 60)
    .length;
const sparks = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        width === 2 && height === 2 && burstColours.includes(colour),
    ).length;
const bullets = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        colour === palette.yellow && width === 1 && height === 4,
    );
const shipX = (t: number) =>
  Math.min(
    ...frames
      .at(t)
      .filter(({ colour, y }) => colour === palette.cyan && y >= 78)
      .map(({ x }) => x),
  );

describe("space shooter", () => {
  it("loses invaders one at a time and gets them back, so the formation is never empty", () => {
    const counts = Array.from({ length: 70 }, (_, at) => invaders(at * 0.2));
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(new Set(counts).size).toBeGreaterThan(3);
  });

  it("fires a bullet that travels up the picture, and the invader bursts when it arrives", () => {
    const early = bullets(0.4)[0];
    const later = bullets(0.6)[0];
    expect(early).toBeDefined();
    expect(later?.y).toBeLessThan(early?.y ?? 0);
    expect(sparks(0.6)).toBe(0);
    expect(sparks(0.8)).toBeGreaterThan(0);
  });

  it("fires no bullet while the ship is still sliding to its next target", () => {
    expect(bullets(0.1)).toHaveLength(0);
  });

  it("slides the ship under the invader it will hit, then holds still while it fires", () => {
    expect(shipX(0.1)).not.toBe(shipX(0.25));
    expect(shipX(0.3)).toBe(shipX(0.6));
  });

  it("brings invaders back as well as taking them, again and again through the loop", () => {
    const counts = Array.from({ length: 70 }, (_, at) => invaders(at * 0.2));
    const returns = counts.filter(
      (count, at) => at > 0 && count > (counts[at - 1] ?? 0),
    );
    expect(returns.length).toBeGreaterThan(5);
  });
});
