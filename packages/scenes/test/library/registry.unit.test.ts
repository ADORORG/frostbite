import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { palette, sceneHeight, sceneWidth } from "../../src/engine/index.ts";
import { ambient, defineScenes, scenes } from "../../src/library/index.ts";
import { framesOf } from "../support/frames.ts";
import type { Drawn } from "../support/surface.ts";

// The most rectangles one frame of any scene may draw: a scene is a few lines of drawing, and a page may run several at once.
const rectBudget = 450;

describe("the scene list", () => {
  it("has a name and an id of its own for every scene", () => {
    expect(new Set(scenes.map(({ id }) => id)).size).toBe(scenes.length);
    for (const scene of scenes) expect(scene.name).not.toBe("");
  });

  it("refuses a repeated id and cannot be changed afterwards", () => {
    const [first] = scenes;
    if (first === undefined) throw new Error("no scenes");
    expect(() => defineScenes([first, first])).toThrow("an id of its own");
    expect(Object.isFrozen(scenes)).toBe(true);
  });
});

describe.each([...scenes, ...ambient])("every scene: $name", (scene) => {
  const frames = framesOf(scene);
  const everyMoment = function* () {
    for (let t = 0; t < frames.loopSeconds; t += 1 / 10) yield frames.at(t);
  };

  it("loops for long enough to be worth watching", () => {
    expect(frames.loopSeconds).toBeGreaterThanOrEqual(5);
  });

  it("draws every moment without a bad number, and nothing that cannot be seen", () => {
    for (const drawn of everyMoment())
      for (const { height, width, x, y } of drawn) {
        for (const value of [x, y, width, height])
          expect(Number.isFinite(value)).toBe(true);
        expect(width).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(sceneWidth);
        expect(y + height).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(sceneHeight);
      }
  });

  it("is the same picture every time it is made and drawn", () => {
    expect(framesOf(scene).at(3)).toEqual(frames.at(3));
  });

  it("uses only the platform's palette", () => {
    const known = new Set<string>(Object.values(palette));
    const used = new Set<string>();
    for (const drawn of everyMoment())
      for (const { colour } of drawn) used.add(colour);
    expect([...used].filter((colour) => !known.has(colour))).toEqual([]);
  });

  it("draws few rectangles a frame, and leaves its alpha as it found it", () => {
    for (const drawn of everyMoment()) {
      expect(drawn.length).toBeLessThanOrEqual(rectBudget);
      for (const { alpha } of drawn) expect(alpha).toBeGreaterThan(0);
    }
  });

  // A scene that fades out or snaps back is a loop with a visible seam; every scene here carries on as if there were none. Shapes touching
  // the very edge may be in or out by a hair, so what is compared is what is clearly inside.
  it("closes without a jump: the last moment and the first look the same", () => {
    const middle = (list: readonly Drawn[]) =>
      list.filter(({ width, x }) => x + width > 1 && x < sceneWidth - 1);
    const key = (d: Drawn) => `${d.colour}|${d.width}|${d.height}|${d.alpha}`;
    const sorted = (list: readonly Drawn[]) =>
      [...list].sort(
        (a, b) => key(a).localeCompare(key(b)) || a.x - b.x || a.y - b.y,
      );
    const end = sorted(middle(frames.at(frames.loopSeconds - 1e-6)));
    const start = sorted(middle(frames.at(0)));
    expect(end.length).toBe(start.length);
    end.forEach((drawn, at) => {
      const other = start[at];
      expect(key(drawn)).toBe(other === undefined ? "" : key(other));
      expect(Math.abs(drawn.x - (other?.x ?? 1e9))).toBeLessThanOrEqual(1);
      expect(Math.abs(drawn.y - (other?.y ?? 1e9))).toBeLessThanOrEqual(1);
    });
  });
});

// A scene is a few lines of drawing code, not an asset: it stays small enough that adding many costs the page almost nothing.
describe("how much each part weighs", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const gzipped = (directory: string, file: string) =>
    gzipSync(readFileSync(join(here, "../../src", directory, file))).length;
  const sceneBudget = 8 * 1024;
  const engineBudget = 10 * 1024;

  it.each(
    readdirSync(join(here, "../../src/library")).filter(
      (file) => file !== "index.ts",
    ),
  )("keeps scene %s under 8 KB compressed", (file) => {
    expect(gzipped("library", file)).toBeLessThan(sceneBudget);
  });

  it("keeps the whole engine under 10 KB compressed", () => {
    const total = readdirSync(join(here, "../../src/engine")).reduce(
      (sum, file) => sum + gzipped("engine", file),
      0,
    );
    expect(total).toBeLessThan(engineBudget);
  });
});
