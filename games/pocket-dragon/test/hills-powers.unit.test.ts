import { describe, expect, it } from "vitest";

import {
  accel,
  arenaTiles,
  arenaX,
  charmSize,
  fireLife,
  groundRow,
  gustTicks,
  heroHeight,
  heroWidth,
  levelTiles,
  magnetReach,
  plasmaReach,
  rainAccel,
  rainFireLife,
  shieldTicks,
  thornHeight,
  tile,
  windPush,
} from "../src/rules/hills/constants.ts";
import { startBoss } from "../src/rules/hills/boss.ts";
import { breathe } from "../src/rules/hills/fire.ts";
import { generateHills } from "../src/rules/hills/level.ts";
import {
  eggsCaught,
  hillsEarned,
  hillsMilestones,
  plasmaGathered,
} from "../src/rules/hills/milestones.ts";
import { startHills } from "../src/rules/hills/state.ts";
import type { HillsState, Weather } from "../src/rules/hills/types.ts";
import { feelOf, windOf } from "../src/rules/hills/weather.ts";
import { flatHills, peak, press, ticks } from "./support/hills-world.ts";

const groundY = groundRow * tile;
const seeds = [3, 4, 20_261_031];
const middle = { x: 2 * tile + heroWidth / 2, y: groundY - heroHeight / 2 };

describe("the weather of Egg Hills", () => {
  it("is strong wind on the first stage, heavy rain on the second and deep fog on the third", () => {
    for (const seed of seeds)
      expect(
        [1, 2, 3].map((stage) => generateHills(seed, stage).weather),
      ).toEqual(["wind", "rain", "fog"]);
  });

  it("blows in gusts, mostly against Glitchy, with calm between, and pushes Glitchy along while it blows", () => {
    const windy = flatHills({ weather: "wind" });
    const pushes = Array.from({ length: 12 }, (_, gust) =>
      windOf({ ...windy, tick: gust * gustTicks }),
    );
    expect(pushes.filter((_, gust) => gust % 2 === 1)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    const gusts = pushes.filter((_, gust) => gust % 2 === 0);
    expect(gusts.every((push) => Math.abs(push) === windPush)).toBe(true);
    expect(gusts.filter((push) => push < 0).length).toBeGreaterThan(
      gusts.filter((push) => push > 0).length,
    );
    expect(windOf({ ...flatHills({ weather: "rain" }), tick: 0 })).toBe(0);
    const blown = ticks({ ...windy, tick: 4 * gustTicks }, 30);
    expect(blown.hero.x).toBe(2 * tile + 30 * (pushes[4] ?? 0));
    expect(ticks({ ...windy, tick: gustTicks }, 30).hero.x).toBe(2 * tile);
  });

  it("makes the grass slippery in the rain and puts fire out sooner; fog changes nothing underfoot", () => {
    const feel = (weather: Weather) => feelOf(flatHills({ weather }));
    expect(feel("rain").accel).toBe(rainAccel);
    expect(feel("fog")).toEqual({ accel, jump: feel("rain").jump, push: 0 });
    const speed = (weather: Weather) =>
      ticks(press(flatHills({ weather }), "right"), 5).hero.vx;
    expect(speed("rain")).toBeLessThan(speed("fog"));
    const puff = (weather: Weather) =>
      breathe(flatHills({ weather }, { hasFire: true })).fireballs[0]?.life;
    expect(puff("rain")).toBe(rainFireLife);
    expect(puff("fog")).toBe(fireLife);
  });
});

describe("the secret charms of Egg Hills", () => {
  it("hide on each stage up cloud steps, out of the way, with a ledge to reach them from", () => {
    for (const seed of seeds)
      for (const stage of [1, 2, 3]) {
        const level = generateHills(seed, stage);
        const column = Math.floor((level.charm.x + charmSize / 2) / tile);
        expect(column).toBeGreaterThan(50);
        expect(column).toBeLessThan(levelTiles - arenaTiles);
        expect(level.charm.y).toBeLessThan((groundRow - 4) * tile);
        expect(level.solid.has(column * 64 + groundRow - 4)).toBe(true);
        expect(level.solid.has((column - 3) * 64 + groundRow - 2)).toBe(true);
      }
  });

  const found = (stage: number): HillsState =>
    ticks(
      press(
        flatHills(
          { charm: { x: 3 * tile, y: groundY - charmSize } },
          { stage },
        ),
        "right",
      ),
      30,
    );

  it("give a feather on stage one, a shield on stage two and a magnet on stage three, once each", () => {
    expect(found(1)).toMatchObject({
      charmTaken: true,
      charms: 1,
      feather: true,
      magnet: false,
      shield: false,
    });
    expect(found(2)).toMatchObject({
      charmTaken: true,
      charms: 1,
      feather: false,
      shield: true,
    });
    expect(found(3)).toMatchObject({
      charmTaken: true,
      charms: 1,
      magnet: true,
    });
    expect(ticks(found(1), 30).charms).toBe(1);
  });

  it("make jumps stronger with the feather", () => {
    const jump = (feather: boolean) =>
      peak(press(flatHills({}, { feather }), "jump"), 60);
    expect(jump(true)).toBeLessThan(jump(false));
  });

  it("take one bump for Glitchy with the shield, which is then used up", () => {
    const thorny = flatHills(
      { thorns: [{ x: 2 * tile, y: groundY - thornHeight }] },
      { shield: true },
    );
    const kept = ticks(thorny, 1);
    expect(kept).toMatchObject({
      hearts: thorny.hearts,
      heartsLost: 0,
      invulnerable: shieldTicks,
      shield: false,
    });
    expect(ticks(kept, shieldTicks + 1).heartsLost).toBe(1);
  });

  it("draw metaplasma from much farther off with the magnet", () => {
    const off = (plasmaReach + magnetReach) / 2;
    const level = { motes: [{ x: middle.x + off, y: middle.y }] };
    expect(ticks(flatHills(level), 1).plasma.drifting).toEqual([]);
    const drawn = ticks(flatHills(level, { magnet: true }), 1);
    expect(drawn.plasma.drifting).toHaveLength(1);
    expect(ticks(drawn, 60).plasma.gathered).toBe(1);
  });
});

describe("the metaplasma of Egg Hills", () => {
  it("is laid out all along each stage over the ground, sorted, one or two to a tile", () => {
    for (const seed of seeds) {
      const { ground, motes } = generateHills(seed, 2);
      expect(motes.length).toBeGreaterThan(levelTiles);
      expect(motes.length).toBeLessThan(2 * levelTiles);
      motes.forEach((mote, at) => {
        expect(mote.x).toBeGreaterThanOrEqual(motes[at - 1]?.x ?? 0);
        const top = Math.min(
          ground[Math.floor(mote.x / tile)] ?? groundRow,
          groundRow,
        );
        expect(mote.y).toBeLessThan(top * tile);
      });
    }
  });

  it("drifts to Glitchy and is banked at each portal, counting toward the run", () => {
    const motes = [{ x: middle.x + 2 * tile, y: middle.y }];
    const gathered = ticks(flatHills({ motes }), 30);
    expect(gathered.plasma.gathered).toBe(1);
    const beaten = { ...startBoss(1, 1), beaten: 0, ghosts: [], started: 0 };
    const atPortal = {
      ...gathered,
      boss: beaten,
      hero: { ...gathered.hero, x: (levelTiles - 5) * tile },
      plasma: { ...gathered.plasma, gathered: 40 },
    };
    const next = ticks(press(atPortal, "right"), 20);
    expect(next.stage).toBe(2);
    expect(next.plasmaBanked).toBe(40);
    expect(next.plasma.gathered).toBeLessThan(40);
    expect(plasmaGathered(next)).toBe(40 + next.plasma.gathered);
  });
});

describe("the new marks of Egg Hills", () => {
  it("are earned for cheering up the guards, freeing the rocket's eggs, a secret charm and a great deal of metaplasma", () => {
    expect(hillsMilestones).toHaveLength(13);
    const start = startHills(4);
    expect(hillsEarned(start)).toEqual([]);
    expect(hillsEarned({ ...start, guardsCheered: 4 })).toEqual([
      "hills-guards",
    ]);
    expect(hillsEarned({ ...start, guardsCheered: 3 })).toEqual([]);
    const freed = { ...start, freedCaught: 10 };
    expect(eggsCaught(freed)).toBe(10);
    expect(hillsEarned(freed)).toEqual(["first-egg", "hills-rocket-eggs"]);
    expect(hillsEarned({ ...start, charms: 1 })).toEqual(["secret-charm"]);
    expect(hillsEarned({ ...start, plasmaBanked: 299 })).toEqual([]);
    expect(
      hillsEarned({
        ...start,
        plasmaBanked: 200,
        plasma: { ...start.plasma, gathered: 100 },
      }),
    ).toEqual(["metaplasma-300"]);
  });
});

describe("the end of each stage", () => {
  it("is the boss's arena: flat ground with nothing else in it, DeFu's ledge out of reach, and the portal at its far end", () => {
    for (const seed of seeds)
      for (const stage of [1, 2, 3]) {
        const level = generateHills(seed, stage);
        expect(
          level.ground
            .slice(levelTiles - arenaTiles - 4)
            .every((row) => row === groundRow),
        ).toBe(true);
        expect(level.patrols.every((patrol) => patrol.maxX < arenaX)).toBe(
          true,
        );
        expect(level.thorns.every((thorn) => thorn.x < arenaX)).toBe(true);
        expect(level.ice.every((cell) => cell.column * tile < arenaX)).toBe(
          true,
        );
        expect(level.solid.has((levelTiles - 1) * 64 + groundRow - 5)).toBe(
          true,
        );
        expect(level.goalX).toBe((levelTiles - 3) * tile);
      }
  });
});
