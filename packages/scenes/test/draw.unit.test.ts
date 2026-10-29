import { describe, expect, it } from "vitest";

import {
  ease,
  rect,
  sceneHeight,
  sceneWidth,
  seededRandom,
  sprite,
  stars,
} from "../src/engine/index.ts";
import { recordingSurface } from "./support/surface.ts";

describe("drawing on the pixel grid", () => {
  it("snaps a rectangle's position to whole pixels and sets its colour", () => {
    const surface = recordingSurface();
    rect(surface, 1.6, 2.4, 3, 4, "#abc");
    expect(surface.drawn).toEqual([
      { alpha: 1, colour: "#abc", height: 4, width: 3, x: 2, y: 2 },
    ]);
  });

  it("draws nothing that falls wholly outside the scene, and the part of what is partly inside", () => {
    const surface = recordingSurface();
    rect(surface, -10, 0, 10, 5, "#a");
    rect(surface, sceneWidth, 0, 5, 5, "#b");
    rect(surface, 0, -5, 5, 5, "#c");
    rect(surface, 0, sceneHeight, 5, 5, "#d");
    rect(surface, -3, 0, 10, 5, "#e");
    sprite(surface, ["##"], sceneWidth - 1, 0, "#f");
    expect(surface.drawn.map(({ colour }) => colour)).toEqual(["#e", "#f"]);
    expect(surface.drawn).toHaveLength(2);
  });

  it("draws a picture from rows of text, one pixel for each hash, and mirrors it on request", () => {
    const plain = recordingSurface();
    sprite(plain, ["#..", ".#."], 10, 20, "#fff");
    expect(plain.drawn.map(({ x, y }) => [x, y])).toEqual([
      [10, 20],
      [11, 21],
    ]);
    const mirrored = recordingSurface();
    sprite(mirrored, ["#..", ".#."], 10, 20, "#fff", true);
    expect(mirrored.drawn.map(({ x, y }) => [x, y])).toEqual([
      [12, 20],
      [11, 21],
    ]);
  });

  it("draws each unbroken run of a row as one rectangle", () => {
    const surface = recordingSurface();
    sprite(surface, ["###.##", "#....#"], 0, 0, "#fff");
    expect(
      surface.drawn.map(({ height, width, x, y }) => [x, y, width, height]),
    ).toEqual([
      [0, 0, 3, 1],
      [4, 0, 2, 1],
      [0, 1, 1, 1],
      [5, 1, 1, 1],
    ]);
    const mirrored = recordingSurface();
    sprite(mirrored, ["###.##"], 0, 0, "#fff", true);
    expect(mirrored.drawn.map(({ width, x }) => [x, width])).toEqual([
      [0, 2],
      [3, 3],
    ]);
  });

  it("eases between 0 and 1 and holds at the ends", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(ease(2)).toBe(1);
    expect(ease(0.25)).toBeLessThan(0.25);
  });
});

describe("a seeded run of numbers", () => {
  it("is the same every time for a seed, differs between seeds, and stays in [0, 1)", () => {
    const first = seededRandom(7);
    const again = seededRandom(7);
    const other = seededRandom(8);
    const a = Array.from({ length: 20 }, first);
    expect(Array.from({ length: 20 }, again)).toEqual(a);
    expect(Array.from({ length: 20 }, other)).not.toEqual(a);
    expect(a.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("stars", () => {
  it("are single pixels inside the scene and above the height given", () => {
    const surface = recordingSurface();
    stars(surface, 3, 40, 30);
    expect(surface.drawn).toHaveLength(40);
    for (const { height, width, x, y } of surface.drawn) {
      expect([width, height]).toEqual([1, 1]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(sceneWidth);
      expect(y).toBeLessThanOrEqual(30);
    }
  });

  it("never reach below the scene whatever height is asked for", () => {
    const surface = recordingSurface();
    stars(surface, 3, 200, 10_000);
    expect(Math.max(...surface.drawn.map(({ y }) => y))).toBeLessThanOrEqual(
      sceneHeight,
    );
  });
});
