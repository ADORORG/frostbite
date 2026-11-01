import { describe, expect, it } from "vitest";

import { meetBoss } from "../src/rules/hills/boss-meet.ts";
import { solidAt } from "../src/rules/hills/collide.ts";
import {
  flapSpeed,
  forceTicks,
  groundRow,
  heroHeight,
  levelTiles,
  pitRow,
  rollerSize,
  rows,
  skyStart,
  springHeight,
  springSpeed,
  stages,
  tile,
  tunnelStart,
  ventEvery,
  ventOn,
  wallRow,
  wingTicks,
  worldTiles,
} from "../src/rules/hills/constants.ts";
import { generateHills } from "../src/rules/hills/level.ts";
import {
  rollerX,
  sectionOf,
  sectionSpan,
  ventOnAt,
} from "../src/rules/hills/secrets.ts";
import { startHero } from "../src/rules/hills/state.ts";
import { feelOf } from "../src/rules/hills/weather.ts";
import type { HillsState, Spot } from "../src/rules/hills/types.ts";
import { flatHills, press, ticks } from "./support/hills-world.ts";

const seeds = [1, 7, 42, 20_261_031, 99_991] as const;
const column = (x: number): number => Math.floor(x / tile);
// Glitchy standing on the ground at column `at`, in a stage with its secret areas.
const standingAt = (at: number, more: Partial<HillsState> = {}) =>
  flatHills(
    { burrow: { x: 20 * tile, y: groundRow * tile }, secrets: true },
    { hero: { ...startHero(), x: at * tile }, ...more },
  );

describe("the secret areas of a stage", () => {
  it("are laid out on every stage: a burrow before the nest, a spring under the swirl cloud after it, and walls between", () => {
    for (const seed of seeds)
      for (let stage = 1; stage <= stages; stage += 1) {
        const level = generateHills(seed, stage);
        const nest = column(level.checkpointX);
        const burrow = column(level.burrow.x);
        expect(level.ground).toHaveLength(worldTiles);
        expect(burrow).toBeLessThan(nest);
        expect(burrow).toBeGreaterThanOrEqual(30);
        expect(level.ground[burrow]).toBe(groundRow);
        expect(level.burrow.y).toBe(groundRow * tile);
        const [spring] = level.springs;
        expect(spring).toBeDefined();
        expect(column(level.cloudGate.x)).toBe(column(spring?.x ?? 0));
        expect(level.cloudGate.y).toBe(tile);
        expect(level.cloudGate.x).toBeGreaterThan(level.checkpointX);
        expect(level.cloudGate.x).toBeLessThan(levelTiles * tile);
        expect(level.ground[column(level.skyExit)]).toBe(groundRow);
        expect(level.tunnelExit).toBe(level.checkpointX + tile);
        expect(level.ground[column(level.tunnelExit)]).toBe(groundRow);
        for (const wall of [levelTiles, skyStart - 1, worldTiles - 1])
          expect(level.ground[wall]).toBe(wallRow);
        expect(sectionOf(level.tunnelEnd.x)).toBe("tunnel");
        expect(sectionOf(level.skyEnd.x)).toBe("sky");
        expect(level.ground[skyStart + 3]).toBe(pitRow);
        for (const spot of [level.wings, level.forcefield])
          expect(sectionOf(spot.x)).toBe("main");
        for (const vent of level.vents)
          expect(level.ground[column(vent.x)]).toBe(groundRow);
        for (const roller of level.rollers)
          expect(roller.y).toBe(groundRow * tile - rollerSize);
      }
    // The later stages mix in boulders.
    expect(
      seeds.some((seed) => generateHills(seed, 3).rollers.length > 0),
    ).toBe(true);
  });

  it("are walled off all the way up, under a ceiling two tiles over the screen", () => {
    const level = generateHills(7, 1);
    const melted = level.ice.map(() => false);
    for (const row of [-2, -1, 0, 4, 8]) {
      expect(solidAt(level, melted, levelTiles, row)).toBe(true);
      expect(solidAt(level, melted, skyStart - 1, row)).toBe(true);
    }
    expect(solidAt(level, melted, 3, -1)).toBe(false);
    expect(solidAt(level, melted, 3, -2)).toBe(false);
    expect(solidAt(level, melted, 3, -3)).toBe(true);
    expect(solidAt(level, melted, worldTiles, 4)).toBe(true);
    expect(sectionSpan("tunnel")).toEqual([tunnelStart, skyStart - 1]);
    expect(sectionSpan("main")).toEqual([0, levelTiles]);
  });

  it("are dug into from the burrow with down, once a stage, and left by the tunnel's ladder up to the nest", () => {
    const start = standingAt(20);
    const dug = press(start, "down");
    expect(sectionOf(dug.hero.x)).toBe("tunnel");
    expect(dug.hero.y).toBe(groundRow * tile - heroHeight);
    expect(dug).toMatchObject({ secretsFound: 1, tunnelFound: true });
    expect(press(standingAt(25), "down").hero.x).toBe(25 * tile);
    const flying = standingAt(20);
    expect(
      press({ ...flying, hero: { ...flying.hero, grounded: false } }, "down")
        .secretsFound,
    ).toBe(0);
    const again = press(
      { ...dug, controls: { ...dug.controls, down: false }, hero: start.hero },
      "down",
    );
    expect(again.secretsFound).toBe(1);
    const atLadder = {
      ...dug,
      hero: { ...dug.hero, x: dug.level.tunnelEnd.x },
    };
    const out = ticks(atLadder, 1);
    expect(out.hero.x).toBe(out.level.tunnelExit);
    expect(out.checkpoint).toBe(true);
  });

  it("are flown into through the swirl cloud, and left by the rainbow or by falling off a cloud, unhurt", () => {
    const gate: Spot = { x: 30 * tile, y: 5 * tile };
    const under = flatHills(
      { cloudGate: gate, secrets: true },
      { hero: { ...startHero(), x: 30 * tile, y: 5 * tile } },
    );
    const up = ticks(under, 1);
    expect(sectionOf(up.hero.x)).toBe("sky");
    expect(up).toMatchObject({ secretsFound: 1, skyFound: true });
    expect(up.hero.y).toBe(6 * tile - heroHeight);
    const rainbow = ticks(
      { ...up, hero: { ...up.hero, x: up.level.skyEnd.x, y: 3 * tile } },
      1,
    );
    expect(rainbow.hero.x).toBe(up.level.skyExit);
    const falling = ticks(
      { ...up, hero: { ...up.hero, x: (skyStart + 3) * tile, y: rows * tile } },
      1,
    );
    expect(falling.hero.x).toBe(up.level.skyExit);
    expect(falling.heartsLost).toBe(0);
  });
});

describe("the new power-ups and obstacles", () => {
  it("throw Glitchy high from a spring mushroom, however jump is held, up to the swirl cloud", () => {
    const spring = { x: 30 * tile, y: groundRow * tile - springHeight };
    const gate = { x: 30 * tile, y: tile };
    const on = flatHills(
      { cloudGate: gate, secrets: true, springs: [spring] },
      { hero: { ...startHero(), x: 30 * tile } },
    );
    const thrown = ticks(on, 1);
    expect(thrown.hero).toMatchObject({ sprung: true, vy: -springSpeed });
    let now = thrown;
    for (let at = 0; at < 40 && sectionOf(now.hero.x) === "main"; at += 1)
      now = ticks(now, 1);
    expect(sectionOf(now.hero.x)).toBe("sky");
    // Without the swirl cloud it comes down, and is no longer thrown once it lands.
    let away = ticks(flatHills({ springs: [spring] }, on), 1);
    for (let at = 0; at < 80 && !away.hero.grounded; at += 1)
      away = ticks(away, 1);
    expect(away.hero.sprung).toBe(false);
  });

  it("give wings that flap in the air for ten seconds, and a forcefield that cheers up what it bumps", () => {
    const wings = { x: 30 * tile, y: 6 * tile };
    const bubble = { x: 40 * tile, y: 6 * tile };
    const level = flatHills(
      {
        forcefield: bubble,
        patrols: [
          { maxX: 50 * tile, minX: 44 * tile, x: 44 * tile, y: 7 * tile - 160 },
        ],
        thorns: [{ x: 47 * tile, y: 7 * tile - 144 }],
        wings,
      },
      { hero: { ...startHero(), x: 30 * tile } },
    );
    const winged = ticks(level, 1);
    expect(winged).toMatchObject({ wings: wingTicks, wingsTaken: true });
    const jumped = ticks(press(winged, "jump"), 6);
    const flapped = press(press(jumped, "jump", false), "jump");
    expect(flapped.hero.vy).toBe(-flapSpeed);
    expect(ticks(winged, 2).wings).toBe(wingTicks - 2);
    const grounded = press(flatHills({}, {}), "jump");
    expect(grounded.hero.vy).toBe(0);
    const shielded = ticks(
      { ...winged, hero: { ...winged.hero, x: 40 * tile } },
      1,
    );
    expect(shielded).toMatchObject({
      forceTaken: true,
      forcefield: forceTicks,
    });
    const through = ticks(
      press({ ...shielded, invulnerable: 0 }, "right"),
      120,
    );
    expect(through.heartsLost).toBe(0);
    expect(through.cheers).toBe(1);
    const unshielded = ticks(
      press({ ...shielded, forcefield: 0, invulnerable: 0 }, "right"),
      120,
    );
    expect(unshielded.heartsLost).toBeGreaterThan(0);
  });

  it("send a guard home that the forcefield bumps, in DeFu's fight", () => {
    const hero = { ...startHero(), x: 155 * tile };
    const boss = {
      beaten: -1,
      freed: [],
      ghosts: [],
      guards: [{ dir: -1 as const, x: 155 * tile }],
      launched: -1,
      rng: 1,
      rocket: null,
      started: 0,
      strike: null,
    };
    const bottom = hero.y + heroHeight;
    expect(meetBoss(boss, hero, bottom, 0, 2, 5, true)).toMatchObject({
      cheered: 1,
      hurt: false,
    });
    expect(meetBoss(boss, hero, bottom, 0, 2, 5)).toMatchObject({
      cheered: 0,
      hurt: true,
    });
  });

  it("puff steam that hurts only while a vent puffs, and roll boulders to and fro that bump from the side and bounce from on top", () => {
    const vent = { phase: 0, x: 30 * tile, y: groundRow * tile };
    expect(ventOnAt(vent, 0)).toBe(true);
    expect(ventOnAt(vent, ventOn)).toBe(false);
    expect(ventOnAt(vent, ventEvery)).toBe(true);
    const near = { ...startHero(), x: 30 * tile - 64 };
    const steamed = ticks(
      flatHills({ vents: [vent] }, { hero: near, tick: ventEvery - 1 }),
      1,
    );
    expect(steamed.heartsLost).toBe(1);
    const calm = ticks(
      flatHills({ vents: [vent] }, { hero: near, tick: ventOn + 5 }),
      1,
    );
    expect(calm.heartsLost).toBe(0);
    const roller = {
      maxX: 40 * tile,
      minX: 30 * tile,
      phase: 0,
      y: 7 * tile - rollerSize,
    };
    expect(rollerX(roller, 0)).toBe(30 * tile);
    expect(rollerX(roller, 256)).toBe(40 * tile);
    expect(rollerX(roller, 384)).toBe(35 * tile);
    const side = ticks(
      flatHills(
        { rollers: [roller] },
        { hero: { ...startHero(), x: 30 * tile - 96 } },
      ),
      1,
    );
    expect(side.heartsLost).toBe(1);
    const above = flatHills(
      { rollers: [roller] },
      {
        hero: {
          ...startHero(),
          grounded: false,
          vy: 30,
          x: 30 * tile,
          y: roller.y - heroHeight - 20,
        },
      },
    );
    const bounced = ticks(above, 1);
    expect(bounced.heartsLost).toBe(0);
    expect(bounced.hero.vy).toBeLessThan(0);
  });

  it("keep the weather and DeFu's fight out of the secret areas", () => {
    const windy = flatHills(
      { secrets: true, weather: "wind" },
      { hero: { ...startHero(), x: (tunnelStart + 3) * tile } },
    );
    expect(feelOf(windy).push).toBe(0);
    expect(feelOf({ ...windy, tick: 0, hero: startHero() }).push).not.toBe(0);
    const fighting = {
      ...windy,
      boss: { ...windy.boss, started: 0 },
      tick: 100,
    };
    expect(ticks(fighting, 30).boss).toEqual(fighting.boss);
  });
});
