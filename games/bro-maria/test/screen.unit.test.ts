import { describe, expect, it } from "vitest";

import {
  groundRow,
  invulnerableTicks,
  levelTiles,
  playerHeight,
  tile,
} from "../src/rules/constants.ts";
import {
  cameraOf,
  draw,
  screenHeight,
  screenWidth,
} from "../src/screen/draw.ts";
import { colour } from "../src/screen/palette.ts";
import { ofColour, surface } from "./support/canvas.ts";
import { flatLevel, onFlat, withHero } from "./support/states.ts";

const painted = (state = onFlat()) => {
  const page = surface();
  draw(page.context, state);
  return page;
};

describe("where the view is", () => {
  it("keeps the hero a little left of the middle, and stops at both ends of the level", () => {
    const hero = onFlat();
    expect(cameraOf(withHero(hero, { x: 0 }))).toBe(0);
    expect(cameraOf(withHero(hero, { x: 50 * tile }))).toBe(50 * 16 - 96);
    expect(cameraOf(withHero(hero, { x: (levelTiles - 1) * tile }))).toBe(
      levelTiles * 16 - screenWidth,
    );
  });
});

describe("drawing the screen", () => {
  it("paints the sky from top to bottom first, and then every picture inside the world", () => {
    const { drawn, stops } = painted();
    expect(stops).toEqual([colour.skyHigh, colour.skyLow]);
    expect(drawn.length).toBeGreaterThan(100);
    for (const block of drawn) {
      expect(
        Number.isFinite(block.x + block.y + block.width + block.height),
      ).toBe(true);
      expect(block.width).toBeGreaterThan(0);
      expect(block.height).toBeGreaterThan(0);
    }
  });

  it("draws the same picture for the same state, and another as the ticks go by", () => {
    const state = onFlat();
    expect(painted(state).drawn).toEqual(painted(state).drawn);
    expect(painted({ ...state, tick: 40 }).drawn).not.toEqual(
      painted(state).drawn,
    );
    expect(screenHeight).toBe(144);
  });

  it("draws the ground where there is ground, and leaves a pit open", () => {
    const ground = Array.from({ length: levelTiles }, () => groundRow);
    ground[10] = groundRow + 3;
    const state = onFlat(flatLevel({ ground }), 8);
    const column = (index: number) =>
      painted(state).drawn.filter(
        ({ fill, x, y }) =>
          fill === colour.snow &&
          y === groundRow * 16 &&
          x === index * 16 - cameraOf(state),
      );
    expect(column(9)).toHaveLength(1);
    const open = ground.map(() => groundRow);
    open[10] = 99;
    const pit = onFlat(flatLevel({ ground: open }), 8);
    const lit = painted(pit).drawn.filter(
      ({ fill, y }) => fill === colour.snow && y === groundRow * 16,
    );
    expect(lit.some(({ x }) => x === 10 * 16 - cameraOf(pit))).toBe(false);
  });

  it("draws a coin until it is taken, and a crate in its own colour until it is bumped", () => {
    const level = flatLevel({
      coins: [{ x: 12 * tile, y: 5 * tile }],
      crates: [{ x: 14, y: 4 }],
      solid: new Set([14 * 64 + 4]),
    });
    const fresh = onFlat(level);
    expect(ofColour(painted(fresh).drawn, colour.coin).length).toBeGreaterThan(
      0,
    );
    expect(ofColour(painted(fresh).drawn, colour.crate).length).toBeGreaterThan(
      0,
    );
    const spent = { ...fresh, coinsTaken: [true], cratesUsed: [true] };
    expect(
      ofColour(painted(spent).drawn, colour.coin).filter(({ y }) => y < 90),
    ).toHaveLength(0);
    expect(ofColour(painted(spent).drawn, colour.crate)).toHaveLength(0);
    expect(
      ofColour(painted(spent).drawn, colour.crateUsed).length,
    ).toBeGreaterThan(0);
  });

  it("draws a slime that is alive and not one that was stomped, and an urchin always", () => {
    const level = flatLevel({
      patrols: [
        {
          maxX: 15 * tile,
          minX: 11 * tile,
          x: 12 * tile,
          y: groundRow * tile - 160,
        },
      ],
      urchins: [{ x: 14 * tile, y: groundRow * tile - 160 }],
    });
    const alive = onFlat(level);
    expect(ofColour(painted(alive).drawn, colour.slime).length).toBeGreaterThan(
      0,
    );
    expect(ofColour(painted(alive).drawn, colour.spike).length).toBeGreaterThan(
      0,
    );
    const stomped = {
      ...alive,
      slimes: [{ alive: false, dir: 1 as const, x: 12 * tile }],
    };
    expect(ofColour(painted(stomped).drawn, colour.slime)).toHaveLength(0);
    expect(
      ofColour(painted(stomped).drawn, colour.spike).length,
    ).toBeGreaterThan(0);
  });

  it("draws the lanterns, the halfway one lit only once it has been passed", () => {
    const level = flatLevel({ checkpointX: 12 * tile });
    const before = onFlat(level);
    const after = { ...before, checkpoint: true };
    expect(ofColour(painted(before).drawn, colour.coin).length).toBeLessThan(
      ofColour(painted(after).drawn, colour.coin).length,
    );
  });

  it("draws the hero standing, running and jumping differently, and blinks while it is safe", () => {
    const state = onFlat();
    const standing = ofColour(painted(state).drawn, colour.parka);
    expect(standing.length).toBeGreaterThan(0);
    const running = painted(withHero(state, { vx: 20 })).drawn;
    const other = painted(withHero({ ...state, tick: 6 }, { vx: 20 })).drawn;
    expect(running).not.toEqual(other);
    const jumping = painted(withHero(state, { grounded: false })).drawn;
    expect(jumping).not.toEqual(painted(state).drawn);
    const blink = (tick: number) =>
      ofColour(
        painted({ ...state, invulnerable: invulnerableTicks, tick }).drawn,
        colour.parka,
      ).length;
    // The goal's lantern is the same red, so a hero who is not drawn leaves one block of it.
    expect(blink(0)).toBe(1);
    expect(blink(4)).toBeGreaterThan(1);
    expect(playerHeight).toBe(224);
  });
});
