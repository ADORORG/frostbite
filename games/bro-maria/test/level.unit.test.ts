import { describe, expect, it } from "vitest";

import { groundRow, levelTiles, pitRow, tile } from "../src/rules/constants.ts";
import { generateLevel } from "../src/rules/level.ts";

const seeds = Array.from({ length: 60 }, (_, at) => (at + 1) * 7919);

describe("a level laid out from a seed", () => {
  it("is the same level for the same seed, and another for another", () => {
    const first = generateLevel(7919);
    const again = generateLevel(7919);
    expect(again.ground).toEqual(first.ground);
    expect(again.coins).toEqual(first.coins);
    expect([...again.solid]).toEqual([...first.solid]);
    expect(generateLevel(7920).ground).not.toEqual(first.ground);
  });

  it("is two hundred tiles wide, flat at the start and the end, with a lantern halfway on flat ground and the goal near the end", () => {
    for (const seed of seeds) {
      const level = generateLevel(seed);
      expect(level.ground).toHaveLength(levelTiles);
      expect(level.ground.slice(0, 8).every((row) => row === groundRow)).toBe(
        true,
      );
      expect(level.ground.slice(-12).every((row) => row === groundRow)).toBe(
        true,
      );
      const lantern = level.checkpointX / tile;
      expect(lantern).toBeGreaterThanOrEqual(100);
      expect(
        level.ground
          .slice(lantern - 2, lantern + 3)
          .every((row) => row === groundRow),
      ).toBe(true);
      expect(level.goalX).toBe((levelTiles - 4) * tile);
    }
  });

  it("can be crossed: a pit is one or two tiles wide with three flat tiles before and after it, and a step is a single tile", () => {
    for (const seed of seeds) {
      const { ground } = generateLevel(seed);
      for (let column = 1; column < levelTiles; column += 1) {
        const here = ground[column] ?? 0;
        const before = ground[column - 1] ?? 0;
        if (here === pitRow && before !== pitRow) {
          let width = 0;
          while (ground[column + width] === pitRow) width += 1;
          expect(width).toBeLessThanOrEqual(2);
          for (let near = 1; near <= 3; near += 1) {
            expect(ground[column - near]).toBe(groundRow);
            expect(ground[column + width + near - 1]).toBe(groundRow);
          }
        } else if (here !== pitRow && before !== pitRow) {
          expect(Math.abs(here - before)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("puts every slime and urchin on flat ground, and keeps room to walk under every floating tile", () => {
    for (const seed of seeds) {
      const level = generateLevel(seed);
      for (const patrol of level.patrols) {
        for (const x of [patrol.minX, patrol.x, patrol.maxX])
          expect(level.ground[Math.floor(x / tile)]).toBe(groundRow);
        expect(patrol.minX).toBeLessThanOrEqual(patrol.x);
        expect(patrol.x).toBeLessThan(patrol.maxX);
      }
      for (const urchin of level.urchins)
        expect(level.ground[Math.floor(urchin.x / tile)]).toBe(groundRow);
      for (const key of level.solid) {
        const column = Math.floor(key / 64);
        const row = key % 64;
        expect(row).toBeLessThan(level.ground[column] ?? 0);
        expect((level.ground[column] ?? 0) - row).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("holds what the marks ask for on every seed: coins, slimes, a trio of slimes close together, and crates", () => {
    for (const seed of seeds) {
      const level = generateLevel(seed);
      expect(level.coins.length).toBeGreaterThanOrEqual(60);
      expect(level.patrols.length).toBeGreaterThanOrEqual(10);
      expect(level.crates.length).toBeGreaterThanOrEqual(8);
      const starts = level.patrols.map(({ x }) => Math.floor(x / tile));
      expect(
        starts.some(
          (x, at) =>
            starts.slice(at + 1).filter((other) => other - x <= 6).length >= 2,
        ),
      ).toBe(true);
      for (const crate of level.crates)
        expect(level.solid.has(crate.x * 64 + crate.y)).toBe(true);
    }
  });

  it("puts every coin where the hero can be: in open air above ground, a platform or a pit", () => {
    for (const seed of seeds) {
      const level = generateLevel(seed);
      for (const coin of level.coins) {
        const column = Math.floor(coin.x / tile);
        const row = Math.floor(coin.y / tile);
        expect(row).toBeLessThan(level.ground[column] ?? 0);
        expect(level.solid.has(column * 64 + row)).toBe(false);
      }
    }
  });
});
