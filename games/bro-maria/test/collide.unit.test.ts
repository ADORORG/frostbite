import { describe, expect, it } from "vitest";

import {
  moveAlongX,
  moveAlongY,
  overlaps,
  solidAt,
  standing,
} from "../src/rules/collide.ts";
import {
  groundRow,
  levelTiles,
  pitRow,
  playerHeight,
  playerWidth,
  tile,
} from "../src/rules/constants.ts";
import { flatLevel } from "./support/states.ts";

const onGround = groundRow * tile - playerHeight;

describe("where the hero can stand", () => {
  it("is solid from a column's top row down, open above, and walled at both edges of the level", () => {
    const level = flatLevel();
    expect(solidAt(level, 5, groundRow)).toBe(true);
    expect(solidAt(level, 5, groundRow + 1)).toBe(true);
    expect(solidAt(level, 5, groundRow - 1)).toBe(false);
    expect(solidAt(level, 5, -3)).toBe(false);
    expect(solidAt(level, -1, 2)).toBe(true);
    expect(solidAt(level, levelTiles, 2)).toBe(true);
    expect(solidAt(level, 5, 40)).toBe(false);
  });

  it("has no ground in a pit, and floating tiles where the level puts them", () => {
    const ground = Array.from({ length: levelTiles }, () => groundRow);
    ground[20] = pitRow;
    const level = flatLevel({ ground, solid: new Set([30 * 64 + 4]) });
    expect(solidAt(level, 20, groundRow)).toBe(false);
    expect(solidAt(level, 30, 4)).toBe(true);
    expect(solidAt(level, 30, 3)).toBe(false);
  });

  it("finds a box that overlaps something on any of its tiles, and not one that only touches", () => {
    const level = flatLevel();
    expect(
      overlaps(level, 10 * tile, onGround, playerWidth, playerHeight),
    ).toBe(false);
    expect(
      overlaps(level, 10 * tile, onGround + 1, playerWidth, playerHeight),
    ).toBe(true);
    expect(standing(level, 10 * tile, onGround)).toBe(true);
    expect(standing(level, 10 * tile, onGround - 5)).toBe(false);
  });
});

describe("moving the hero", () => {
  const wall = flatLevel({ solid: new Set([12 * 64 + (groundRow - 1)]) });

  it("goes on when nothing is in the way", () => {
    expect(moveAlongX(wall, 10 * tile, onGround, 20)).toEqual({
      blocked: false,
      x: 10 * tile + 20,
    });
  });

  it("stops against a wall on the right, flush with it, and against one on the left", () => {
    const right = moveAlongX(wall, 12 * tile - playerWidth - 5, onGround, 20);
    expect(right).toEqual({ blocked: true, x: 12 * tile - playerWidth });
    const left = moveAlongX(wall, 13 * tile + 5, onGround, -20);
    expect(left).toEqual({ blocked: true, x: 13 * tile });
  });

  it("falls through open air, lands flush on the ground, and says which it did", () => {
    const level = flatLevel();
    expect(moveAlongY(level, 10 * tile, onGround - 100, 40)).toEqual({
      hit: null,
      y: onGround - 60,
    });
    expect(moveAlongY(level, 10 * tile, onGround - 10, 40)).toEqual({
      hit: "floor",
      y: onGround,
    });
  });

  it("is stopped by a ceiling, flush under it, and says which row it struck", () => {
    const level = flatLevel({ solid: new Set([10 * 64 + 4]) });
    const rise = moveAlongY(level, 10 * tile, 5 * tile + 10, -40);
    expect(rise).toEqual({ hit: "ceiling", row: 4, y: 5 * tile });
  });
});
