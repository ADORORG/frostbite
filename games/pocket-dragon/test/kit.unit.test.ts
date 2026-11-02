import { describe, expect, it } from "vitest";

import { blazeTicks, emptyPack, startPowers } from "../src/rules/kit.ts";
import { blastAtBoss } from "../src/rules/hills/boss-meet.ts";
import { startBoss } from "../src/rules/hills/boss.ts";
import {
  arenaTiles,
  blastLife,
  blastSize,
  blastSpeed,
  fireLife,
  gloomHeight,
  groundRow,
  invulnerableTicks,
  levelTiles,
  pickupSize,
  rollerSize,
  tile,
} from "../src/rules/hills/constants.ts";
import { generateHills } from "../src/rules/hills/level.ts";
import { startHero } from "../src/rules/hills/state.ts";
import { tickHills } from "../src/rules/hills/tick.ts";
import type { HillsState } from "../src/rules/hills/types.ts";
import { ghostAt, groundY } from "./support/hills-fight.ts";
import { flatHills, flatLevel, press, ticks } from "./support/hills-world.ts";

const ground = groundRow * tile;
const packed = (more: Partial<typeof emptyPack>) =>
  startPowers({ big: false, pack: { ...emptyPack, ...more } });

describe("the backpack in Egg Hills", () => {
  const onStart = { x: 2 * tile, y: (groundRow - 1) * tile + 32 };

  it("lays out three foods along every stage, over flat ground and out of the arena, the same for the same seed", () => {
    for (let seed = 1; seed <= 20; seed += 1)
      for (let stage = 1; stage <= 3; stage += 1) {
        const { ground: tops, kit } = generateHills(seed, stage);
        expect(kit.map((spot) => spot.item).sort()).toEqual([
          "berry",
          "mushroom",
          "pineapple",
        ]);
        for (const spot of kit) {
          const column = Math.floor(spot.x / tile);
          expect(column).toBeLessThan(levelTiles - arenaTiles);
          expect(tops[column - 1]).toBe(tops[column]);
          expect(spot.y).toBe(
            ((tops[column] ?? 0) - 1) * tile + (tile - pickupSize) / 2,
          );
        }
      }
    expect(generateHills(9, 2).kit).toEqual(generateHills(9, 2).kit);
  });

  it("picks a food up by touching it, and the fire berry too once Glitchy breathes fire", () => {
    const state = flatHills({ kit: [{ item: "mushroom", ...onStart }] });
    const took = tickHills(state);
    expect(took.kitTaken).toEqual([true]);
    expect(took.powers.pack.mushroom).toBe(1);
    expect(took.powers.news).toEqual({
      item: "mushroom",
      tick: 1,
      what: "packed",
    });
    expect(ticks(took, 5).powers.pack.mushroom).toBe(1);
    const fiery = tickHills(flatHills({ berry: onStart }, { hasFire: true }));
    expect(fiery.berryTaken).toBe(true);
    expect(fiery.powers.pack.berry).toBe(1);
    const first = tickHills(flatHills({ berry: onStart }));
    expect(first.hasFire).toBe(true);
    expect(first.powers.pack.berry).toBe(0);
  });

  it("eats a berry for fire (if there is none yet) and a blaze that sends puffs twice as far", () => {
    const state = flatHills({}, { powers: packed({ berry: 1 }) });
    expect(press(flatHills(), "fire").fireballs).toHaveLength(0);
    const ate = press(state, "berry");
    expect(ate.hasFire).toBe(true);
    expect(ate.powers.blaze).toBe(blazeTicks);
    expect(press(ate, "fire").fireballs[0]?.life).toBe(fireLife * 2);
    const plain = flatHills({}, { hasFire: true });
    expect(press(plain, "fire").fireballs[0]?.life).toBe(fireLife);
    expect(ticks(ate, blazeTicks).powers.blaze).toBe(0);
    expect(press(flatHills(), "berry").powers).toEqual(startPowers());
  });

  it("throws a glitch blast that rolls a long way along the ground, then fades", () => {
    const state = press(
      flatHills({}, { powers: packed({ mushroom: 1 }) }),
      "mushroom",
    );
    expect(state.blasts).toHaveLength(1);
    expect(state.powers.pack.mushroom).toBe(0);
    const later = ticks(state, 100);
    const ball = later.blasts[0];
    expect(ball?.y).toBe(ground - blastSize);
    expect(ball?.x).toBe((state.blasts[0]?.x ?? 0) + 100 * blastSpeed);
    expect(ticks(later, blastLife).blasts).toEqual([]);
    expect(blastLife * blastSpeed).toBeGreaterThan(30 * tile);
  });

  it("clears its way: cheers up a gloomling, glitches away a thorn bush and a boulder, and melts an ice wall to roll on through", () => {
    const patrol = {
      maxX: 12 * tile,
      minX: 8 * tile,
      x: 10 * tile,
      y: ground - gloomHeight,
    };
    const roller = {
      maxX: 24 * tile,
      minX: 20 * tile,
      phase: 0,
      y: ground - rollerSize,
    };
    const wall = [4, 5, 6].map((row) => ({ column: 16, row }));
    const thorn = { x: 14 * tile, y: ground - 144 };
    const state = press(
      flatHills(
        { ice: wall, patrols: [patrol], rollers: [roller], thorns: [thorn] },
        { powers: packed({ mushroom: 1 }) },
      ),
      "mushroom",
    );
    const after = ticks(state, 160);
    expect(after.glooms[0]?.alive).toBe(false);
    expect(after.cheers).toBe(1);
    expect(after.thornsGone).toEqual([true]);
    expect(after.melted).toEqual([true, true, true]);
    expect(after.meltedCount).toBe(3);
    expect(after.rollersGone).toEqual([true]);
    expect(after.blasts[0]?.x).toBeGreaterThan(24 * tile);
    const walked = ticks(
      { ...after, hero: { ...startHero(), x: thorn.x }, invulnerable: 0 },
      5,
    );
    expect(walked.heartsLost).toBe(0);
  });

  it("climbs a step a tile high, but bursts against a taller one, and is lost down a pit", () => {
    const shaped = (top: number): HillsState => {
      const level = flatLevel();
      return press(
        flatHills(
          {},
          {
            level: {
              ...level,
              ground: level.ground.map((row, column) =>
                column >= 8 && column < 40 ? top : row,
              ),
            },
            powers: packed({ mushroom: 1 }),
          },
        ),
        "mushroom",
      );
    };
    const climbed = ticks(shaped(groundRow - 1), 60).blasts[0];
    expect(climbed?.x).toBeGreaterThan(9 * tile);
    expect(climbed?.y).toBe(ground - tile - blastSize);
    expect(ticks(shaped(groundRow - 2), 60).blasts).toEqual([]);
    const pit = press(
      flatHills({ pits: [8, 9, 10] }, { powers: packed({ mushroom: 1 }) }),
      "mushroom",
    );
    expect(ticks(pit, 80).blasts).toEqual([]);
  });

  it("sends DeFu's guards home and hits a ghost dragon on its way, and passes by a fight not yet begun", () => {
    const begun = {
      ...startBoss(5, 1),
      ghosts: [ghostAt(30 * tile)],
      guards: [{ dir: -1 as const, x: 30 * tile }],
      started: 0,
    };
    const hit = blastAtBoss(
      begun,
      30 * tile,
      groundY - blastSize,
      blastSize,
      40,
    );
    expect(hit.cheered).toBe(1);
    expect(hit.boss.guards).toEqual([]);
    const missed = blastAtBoss(
      begun,
      2 * tile,
      groundY - blastSize,
      blastSize,
      40,
    );
    expect(missed.boss).toBe(begun);
    const waiting = startBoss(5, 1);
    expect(blastAtBoss(waiting, 0, 0, blastSize, 1).boss).toBe(waiting);
  });

  it("grows Glitchy with a pineapple, and a bump then only shrinks Glitchy back", () => {
    const patrol = {
      maxX: 10 * tile,
      minX: 2 * tile,
      x: 2 * tile + 100,
      y: ground - gloomHeight,
    };
    const big = press(
      flatHills({ patrols: [patrol] }, { powers: packed({ pineapple: 2 }) }),
      "pineapple",
    );
    expect(big.powers.big).toBe(true);
    expect(
      press(press(big, "pineapple", false), "pineapple").powers.pack.pineapple,
    ).toBe(1);
    const bumped = tickHills(big);
    expect(bumped.hearts).toBe(big.hearts);
    expect(bumped.powers.big).toBe(false);
    expect(bumped.powers.shrinks).toBe(1);
    expect(bumped.invulnerable).toBe(invulnerableTicks);
    expect(bumped.heartsLost).toBe(0);
  });
});
