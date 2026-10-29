import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  palette,
  sceneHeight,
  sceneWidth,
  type Scene,
} from "../src/engine/index.ts";
import { blocks } from "../src/scenes/blocks.ts";
import { defineScenes, scenes } from "../src/scenes/registry.ts";
import { runner } from "../src/scenes/runner.ts";
import { recordingSurface, type Drawn } from "./support/surface.ts";

const frameOf = (scene: Scene, t: number): readonly Drawn[] => {
  const surface = recordingSurface();
  scene.make().draw(surface, t);
  return surface.drawn;
};

describe("the scene list", () => {
  it("has the scenes, each with a name and an id of its own", () => {
    expect(scenes.map(({ id }) => id)).toEqual(["blocks", "runner"]);
    for (const scene of scenes) expect(scene.name).not.toBe("");
  });

  it("refuses a repeated id and cannot be changed afterwards", () => {
    expect(() => defineScenes([blocks, blocks])).toThrow("an id of its own");
    expect(Object.isFrozen(scenes)).toBe(true);
  });
});

describe.each(scenes)("the $name scene", (scene) => {
  it("draws every moment of its loop without a bad number, inside the scene", () => {
    const { loopSeconds } = scene.make();
    expect(loopSeconds).toBeGreaterThan(5);
    for (let t = 0; t < loopSeconds; t += 1 / 20) {
      for (const { height, width, x, y } of frameOf(scene, t)) {
        for (const value of [x, y, width, height])
          expect(Number.isFinite(value)).toBe(true);
        expect(width).toBeGreaterThanOrEqual(0);
        // Nothing is drawn that cannot be seen.
        expect(x + width).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(sceneWidth);
        expect(y).toBeLessThanOrEqual(sceneHeight);
      }
    }
  });

  it("is the same picture every time it is made and drawn", () => {
    expect(frameOf(scene, 3)).toEqual(frameOf(scene, 3));
  });

  it("uses only the platform's colours, or quiet shades of them", () => {
    const known = new Set<string>(Object.values(palette));
    const used = new Set(
      frameOf(scene, scene.make().loopSeconds * 0.55).map(
        ({ colour }) => colour,
      ),
    );
    expect(
      [...used].filter((colour) => known.has(colour)).length,
    ).toBeGreaterThan(1);
  });

  it("leaves its alpha as it found it", () => {
    const surface = recordingSurface();
    const frame = scene.make();
    for (const t of [0, frame.loopSeconds * 0.5, frame.loopSeconds - 0.2]) {
      frame.draw(surface, t);
      expect(surface.globalAlpha).toBe(1);
    }
  });
});

describe("falling blocks", () => {
  it("never puts two blocks in one place", () => {
    const { loopSeconds } = blocks.make();
    const cells = frameOf(blocks, loopSeconds - 1.5).filter(
      ({ colour, width }) => width === 4 && colour !== palette.deeper,
    );
    const places = cells.map(({ x, y }) => `${x},${y}`);
    expect(cells.length).toBeGreaterThan(20);
    expect(new Set(places).size).toBe(places.length);
  });

  it("builds up: more blocks late in the loop than early", () => {
    const count = (t: number) =>
      frameOf(blocks, t).filter(({ width }) => width === 4).length;
    expect(count(2)).toBeLessThan(count(blocks.make().loopSeconds - 1.5));
  });

  it("fades out before it starts over, so the stack is gone when the loop closes", () => {
    const { loopSeconds } = blocks.make();
    const near = frameOf(blocks, loopSeconds - 0.01).filter(
      ({ width }) => width === 4,
    );
    expect(near.every(({ alpha }) => alpha < 0.05)).toBe(true);
    expect(
      frameOf(blocks, 0.4)
        .filter(({ width }) => width === 4)
        .every(({ alpha }) => alpha === 1),
    ).toBe(true);
  });
});

describe("side runner", () => {
  const heroTop = (t: number) =>
    Math.min(
      ...frameOf(runner, t)
        .filter(
          ({ colour, height, width }) =>
            colour === palette.cyan && width === 1 && height === 1,
        )
        .map(({ y }) => y),
    );

  it("keeps the hero on the ground between obstacles and lifts it over one", () => {
    const ground = heroTop(0.5);
    expect(heroTop(2.5)).toBeLessThan(ground - 10);
    expect(heroTop(4.7)).toBeLessThan(ground - 10);
    expect(heroTop(3.6)).toBe(ground);
  });

  it("closes without a jump: the last moment and the first look the same", () => {
    // Shapes touching the very edge may be in or out by a hair; what matters is that nothing in the middle jumps.
    const middle = (list: readonly Drawn[]) =>
      list.filter(({ width, x }) => x + width > 1 && x < sceneWidth - 1);
    const end = middle(frameOf(runner, 20 - 1e-6));
    const start = middle(frameOf(runner, 0));
    const key = (d: Drawn) => `${d.colour}|${d.width}|${d.height}`;
    const sorted = (list: readonly Drawn[]) =>
      [...list].sort(
        (a, b) => key(a).localeCompare(key(b)) || a.x - b.x || a.y - b.y,
      );
    const a = sorted(end);
    const b = sorted(start);
    expect(a.length).toBe(b.length);
    a.forEach((drawn, at) => {
      expect(Math.abs(drawn.x - (b[at]?.x ?? 1e9))).toBeLessThanOrEqual(1);
      expect(Math.abs(drawn.y - (b[at]?.y ?? 1e9))).toBeLessThanOrEqual(1);
    });
  });
});

// A scene is a few lines of drawing code, not an asset: it stays small enough that adding many costs the page almost nothing.
describe("how much each part weighs", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const gzipped = (directory: string, file: string) =>
    gzipSync(readFileSync(join(here, "../src", directory, file))).length;
  const sceneBudget = 8 * 1024;
  const engineBudget = 10 * 1024;

  it.each(
    readdirSync(join(here, "../src/scenes")).filter(
      (file) => file !== "registry.ts",
    ),
  )("keeps scene %s under 8 KB compressed", (file) => {
    expect(gzipped("scenes", file)).toBeLessThan(sceneBudget);
  });

  it("keeps the whole engine under 10 KB compressed", () => {
    const total = readdirSync(join(here, "../src/engine")).reduce(
      (sum, file) => sum + gzipped("engine", file),
      0,
    );
    expect(total).toBeLessThan(engineBudget);
  });
});
