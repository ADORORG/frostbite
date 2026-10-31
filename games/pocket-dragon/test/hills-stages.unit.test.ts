import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { pitRow, stages, tile } from "../src/rules/hills/constants.ts";
import { generateHills, stageSeed } from "../src/rules/hills/level.ts";
import {
  eggsCaught,
  hillsEarned,
  hillsMilestones,
} from "../src/rules/hills/milestones.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";
import { playHills } from "./support/hills-bot.ts";

const seeds = Array.from({ length: 60 }, (_, at) => at * 7_919 + 13);
const widestPit = (ground: readonly number[]): number => {
  let widest = 0;
  let run = 0;
  for (const row of ground) {
    run = row >= pitRow ? run + 1 : 0;
    widest = Math.max(widest, run);
  }
  return widest;
};

describe("the stages of Egg Hills", () => {
  it("are laid out from the run's seed and the stage alone, each stage differently", () => {
    expect(generateHills(3, 2)).toEqual(generateHills(3, 2));
    expect(generateHills(3, 1).ground).not.toEqual(generateHills(3, 2).ground);
    expect(new Set([1, 2, 3].map((stage) => stageSeed(3, stage))).size).toBe(3);
  });

  it("always have the fire berry before the first ice wall, a golden egg up high, the nest halfway and pits no wider than two tiles", () => {
    for (const seed of seeds)
      for (let stage = 1; stage <= stages; stage += 1) {
        const level = generateHills(seed, stage);
        const berryColumn = Math.floor(level.berry.x / tile);
        const firstIce = Math.min(...level.ice.map(({ column }) => column));
        expect(berryColumn).toBeGreaterThan(0);
        expect(firstIce - berryColumn).toBeGreaterThanOrEqual(6);
        expect(level.golden.y).toBeLessThan(5 * tile);
        expect(level.checkpointX).toBeGreaterThan(70 * tile);
        expect(level.checkpointX).toBeLessThan(level.goalX);
        expect(widestPit(level.ground)).toBeLessThanOrEqual(2);
        expect(level.ground.slice(0, 8).every((row) => row < pitRow)).toBe(
          true,
        );
      }
  });

  it("get harder: more pits and faster gloomlings stage by stage, and always enough eggs, ice and gloomlings for every mark", () => {
    const pits = [0, 0, 0];
    for (const seed of seeds) {
      let eggs = 0;
      let ice = 0;
      let gloomlings = 0;
      for (let stage = 1; stage <= stages; stage += 1) {
        const level = generateHills(seed, stage);
        eggs += level.eggs.length;
        ice += level.ice.length;
        gloomlings += level.patrols.length;
        pits[stage - 1] =
          (pits[stage - 1] ?? 0) +
          level.ground.filter(
            (row, at) => row >= pitRow && (level.ground[at - 1] ?? 0) < pitRow,
          ).length;
      }
      expect(eggs).toBeGreaterThanOrEqual(90);
      expect(ice).toBeGreaterThanOrEqual(15);
      expect(gloomlings).toBeGreaterThanOrEqual(8);
    }
    const [first = 0, second = 0, third = 0] = pits;
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(
      [1, 2, 3].map((stage) => generateHills(1, stage).gloomSpeed),
    ).toEqual([5, 7, 9]);
  });
});

describe("Egg Hills' milestones", () => {
  it("are decided by the run's counts alone", () => {
    const start = startHills(1);
    expect(hillsEarned(start)).toEqual([]);
    const busy = {
      ...start,
      breaths: 1,
      cheers: 5,
      eggsBanked: 60,
      goldens: 3,
      meltedCount: 15,
      stagesCleared: 1,
    };
    expect(eggsCaught(busy)).toBe(60);
    expect(hillsEarned(busy)).toEqual([
      "first-egg",
      "eggs-25",
      "eggs-60",
      "golden-egg",
      "golden-eggs-3",
      "fire-breath",
      "ice-melter",
      "cheer-5",
      "hills-stage-2",
    ]);
    const bumped = {
      ...busy,
      finishTick: 900,
      heartsLost: 1,
      stagesCleared: 3,
    };
    expect(hillsEarned(bumped)).toContain("hills-clear");
    expect(hillsEarned(bumped)).not.toContain("hills-no-bumps");
    expect(hillsEarned({ ...bumped, heartsLost: 0 })).toContain(
      "hills-no-bumps",
    );
  });

  // A good player is a player who sees what is coming (`support/hills-bot.ts`). On these seeds it clears all three stages without a bump,
  // so every mark of the chapter can be earned on them.
  it("can all be earned in one run, played well", () => {
    for (const seed of [20_261_031, 7]) {
      const played = playHills(seed);
      expect(played.state.finishTick).not.toBeNull();
      expect(hillsEarned(played.state)).toEqual(hillsMilestones);
      expect(played.inputs.length).toBeLessThan(500);
    }
  }, 60_000);

  it("are what the sample run claims, and what replaying it through the published rules gives", () => {
    const sample = sampleRun();
    expect(sample.config).toEqual({ cabinet: "hills" });
    expect(replayRecord(pocketDragonRules, sample)).toEqual({
      earned: sample.claims,
      ok: true,
    });
    expect(sample.claims).toEqual(hillsMilestones);
  });
});
