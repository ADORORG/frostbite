import { describe, expect, it } from "vitest";

import { columnsOf } from "../src/rules/collide.ts";
import {
  accel,
  bufferTicks,
  coyoteTicks,
  gravity,
  groundRow,
  jumpSpeed,
  maxFall,
  playerHeight,
  playerWidth,
  shortHop,
  tile,
  topSpeed,
} from "../src/rules/constants.ts";
import { moveHero, pressJump } from "../src/rules/hero.ts";
import { flatLevel, onFlat } from "./support/states.ts";

const none = { jump: false, left: false, right: false };
const level = flatLevel();
const ground = onFlat(level).hero;

describe("running", () => {
  it("speeds up toward the top speed a step a tick, and no further", () => {
    let hero = ground;
    for (let tick = 1; tick <= 20; tick += 1) {
      hero = moveHero(level, hero, { ...none, right: true }, []).hero;
      expect(hero.vx).toBe(Math.min(topSpeed, accel * tick));
    }
    expect(hero.x).toBeGreaterThan(ground.x);
  });

  it("runs the other way for left, and slows to a stop with nothing held", () => {
    const left = moveHero(level, ground, { ...none, left: true }, []).hero;
    expect(left.vx).toBe(-accel);
    const stopping = moveHero(level, { ...ground, vx: 3 }, none, []).hero;
    expect(stopping.vx).toBe(1);
    expect(moveHero(level, stopping, none, []).hero.vx).toBe(0);
    expect(moveHero(level, { ...ground, vx: -3 }, none, []).hero.vx).toBe(-1);
  });

  it("holds still when both ways are held, and stops dead against a wall", () => {
    const both = moveHero(
      level,
      ground,
      { ...none, left: true, right: true },
      [],
    ).hero;
    expect(both.vx).toBe(0);
    const walled = flatLevel({ solid: new Set([11 * 64 + groundRow - 1]) });
    const near = { ...ground, vx: topSpeed, x: 11 * tile - playerWidth };
    const pushed = moveHero(walled, near, { ...none, right: true }, []).hero;
    expect(pushed.vx).toBe(0);
    expect(pushed.x).toBe(11 * tile - playerWidth);
  });
});

describe("jumping", () => {
  it("leaves the ground at the jump speed when a jump was pressed, and counts that press once", () => {
    const moved = moveHero(
      level,
      pressJump(ground),
      { ...none, jump: true },
      [],
    );
    expect(moved.hero.vy).toBe(-jumpSpeed + gravity);
    expect(moved.hero.grounded).toBe(false);
    expect(moved.hero.buffer).toBe(0);
    const again = moveHero(level, moved.hero, { ...none, jump: true }, []);
    expect(again.hero.vy).toBe(-jumpSpeed + 2 * gravity);
  });

  it("does not jump without a press, even when the button is held", () => {
    const held = moveHero(level, ground, { ...none, jump: true }, []);
    expect(held.hero.grounded).toBe(true);
    expect(held.hero.vy).toBe(0);
  });

  it("is cut to a short hop when the button is let go early, and goes the full height when it is held", () => {
    const risen = (jump: boolean): number => {
      let hero = pressJump(ground);
      let lowest = hero.y;
      for (let tick = 0; tick < 60; tick += 1) {
        hero = moveHero(
          level,
          hero,
          { ...none, jump: jump || tick < 1 },
          [],
        ).hero;
        lowest = Math.min(lowest, hero.y);
      }
      return ground.y - lowest;
    };
    const full = risen(true);
    const hop = risen(false);
    expect(full).toBeGreaterThan(600);
    expect(hop).toBeLessThan(full / 2);
    expect(hop).toBeGreaterThan(0);
    expect(shortHop).toBeLessThan(jumpSpeed);
  });

  it("counts a jump pressed a few ticks before landing, and not one pressed too early", () => {
    const falling = { ...ground, grounded: false, vy: 10, y: ground.y - 60 };
    let early = pressJump(falling);
    for (let tick = 0; tick < 30 && !early.grounded; tick += 1)
      early = moveHero(level, early, { ...none, jump: true }, []).hero;
    expect(early.grounded).toBe(true);
    early = moveHero(level, early, { ...none, jump: true }, []).hero;
    expect(early.vy).toBe(-jumpSpeed + gravity);
    expect(bufferTicks).toBeGreaterThan(2);
    const tooEarly = { ...pressJump(falling), buffer: 1 };
    let landed = tooEarly;
    for (let tick = 0; tick < 30 && !landed.grounded; tick += 1)
      landed = moveHero(level, landed, { ...none, jump: true }, []).hero;
    landed = moveHero(level, landed, { ...none, jump: true }, []).hero;
    expect(landed.vy).toBe(0);
    expect(landed.grounded).toBe(true);
  });

  it("still jumps a few ticks after running off an edge, and not after that", () => {
    const air = { ...ground, grounded: false, vy: 0, y: ground.y - 40 };
    const soon = moveHero(
      level,
      pressJump({ ...air, coyote: 3 }),
      { ...none, jump: true },
      [],
    );
    expect(soon.hero.vy).toBe(-jumpSpeed + gravity);
    const late = moveHero(
      level,
      pressJump({ ...air, coyote: 0 }),
      { ...none, jump: true },
      [],
    );
    expect(late.hero.vy).toBe(gravity);
    expect(coyoteTicks).toBeGreaterThan(2);
  });

  it("gives the coyote time back on the ground and takes it away in the air", () => {
    expect(moveHero(level, ground, none, []).hero.coyote).toBe(coyoteTicks);
    const air = { ...ground, coyote: 4, grounded: false, y: ground.y - 300 };
    expect(moveHero(level, air, none, []).hero.coyote).toBe(3);
  });
});

describe("falling and landing", () => {
  it("speeds up by gravity and no faster than the fall limit, and says it landed once", () => {
    let hero = { ...ground, grounded: false, vy: 0, y: 0 };
    for (let tick = 0; tick < 40; tick += 1) {
      const moved = moveHero(level, hero, none, []);
      expect(moved.falling).toBe(Math.min(maxFall, hero.vy + gravity));
      expect(moved.hero.vy).toBeLessThanOrEqual(maxFall);
      hero = moved.hero;
    }
    const landing = moveHero(
      level,
      { ...ground, grounded: false, vy: 30, y: ground.y - 20 },
      none,
      [],
    );
    expect(landing.landed).toBe(true);
    expect(landing.hero.grounded).toBe(true);
    expect(moveHero(level, landing.hero, none, []).landed).toBe(false);
  });
});

describe("bumping a crate", () => {
  const crate = { x: 10, y: groundRow - 3 };
  const crates = flatLevel({
    crates: [crate],
    solid: new Set([10 * 64 + crate.y]),
  });
  const underneath = {
    ...ground,
    grounded: false,
    vy: -50,
    y: (crate.y + 1) * tile + 20,
    x: 10 * tile + 30,
  };

  it("reports the crate the head struck, and stops the rise", () => {
    const moved = moveHero(crates, underneath, none, [false]);
    expect(moved.bumped).toEqual([0]);
    expect(moved.hero.vy).toBe(0);
    expect(moved.hero.y).toBe((crate.y + 1) * tile);
  });

  it("does not report a crate that has already been bumped, nor a plain tile", () => {
    expect(moveHero(crates, underneath, none, [true]).bumped).toEqual([]);
    const plain = flatLevel({ solid: new Set([10 * 64 + crate.y]) });
    expect(moveHero(plain, underneath, none, []).bumped).toEqual([]);
  });

  it("reports a crate over only part of the hero's width, and none to the side", () => {
    const edge = { ...underneath, x: 9 * tile + playerWidth * 2 };
    expect(moveHero(crates, edge, none, [false]).bumped).toEqual([0]);
    expect(columnsOf(edge.x)).toContain(10);
    const away = { ...underneath, x: 14 * tile };
    expect(moveHero(crates, away, none, [false]).bumped).toEqual([]);
  });

  it("is not set off by a hero that is going down", () => {
    const falling = { ...underneath, vy: 20, y: (crate.y + 1) * tile + 60 };
    expect(moveHero(crates, falling, none, [false]).bumped).toEqual([]);
    expect(playerHeight).toBeGreaterThan(0);
  });
});
