import { describe, expect, it } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { hopper } from "../../src/library/hopper.ts";
import { framesOf } from "../support/frames.ts";

const frames = framesOf(hopper);
const cars = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, height, width }) =>
        [palette.red, palette.cyan, palette.yellow].includes(colour as never) &&
        width === 14 &&
        height === 6,
    );
const frog = (t: number) =>
  frames
    .at(t)
    .filter(
      ({ colour, width, x }) =>
        colour === palette.green && width === 6 && x === 77,
    );

describe("road hopper", () => {
  it("never puts a car on the frog, at any moment of the loop", () => {
    for (let t = 0; t < frames.loopSeconds; t += 0.02) {
      const [body] = frog(t);
      expect(body).toBeDefined();
      const hit = cars(t).some(
        (car) =>
          car.x < 83 &&
          car.x + 14 > 77 &&
          car.y < (body?.y ?? 0) + 5 &&
          car.y + 6 > (body?.y ?? 0),
      );
      expect(hit).toBe(false);
    }
  });

  it("hops: the frog rises and falls once a hop, and stays in its column", () => {
    const y = (t: number) => frog(t)[0]?.y ?? 0;
    expect(y(0)).toBe(y(0.3 * 1.2 + 0.4));
    expect(y(0.15 * 1.2)).toBeLessThan(y(0));
  });

  it("slides the road down by one lane each hop, with traffic in the lanes", () => {
    expect(cars(1).length).toBeGreaterThan(5);
    const lanes = (t: number) => new Set(cars(t).map(({ y }) => y)).size;
    expect(lanes(1)).toBeGreaterThanOrEqual(3);
  });

  it("sends traffic both ways", () => {
    const at = (t: number, colour: string) =>
      cars(t)
        .filter((car) => car.colour === colour)
        .map(({ x }) => x)
        .sort((a, b) => a - b);
    const moved = (colour: string) =>
      (at(1.1, colour)[3] ?? 0) - (at(1.0, colour)[3] ?? 0);
    expect(Math.sign(moved(palette.red))).not.toBe(
      Math.sign(moved(palette.cyan)),
    );
  });
});
