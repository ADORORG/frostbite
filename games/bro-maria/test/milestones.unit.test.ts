import { describe, expect, it } from "vitest";

import { levelTiles, speedrunTicks } from "../src/rules/constants.ts";
import {
  checkpointTile,
  coinsTaken,
  earnedBy,
  milestoneIds,
} from "../src/rules/milestones.ts";
import { startRun } from "../src/rules/state.ts";
import type { State } from "../src/rules/types.ts";

const fresh = startRun(9);
const taking = (count: number): readonly boolean[] =>
  fresh.coinsTaken.map((_, at) => at < count);
const won = (over: Partial<State> = {}): State => ({
  ...fresh,
  finishTick: 2_500,
  lives: 3,
  ...over,
});

describe("the marks", () => {
  it("are twenty, each named once", () => {
    expect(milestoneIds).toHaveLength(20);
    expect(new Set(milestoneIds).size).toBe(20);
  });

  it("start with none earned", () => {
    expect(earnedBy(fresh)).toEqual([]);
  });

  it.each([
    ["first-steps", { farthest: 10 }, { farthest: 9 }],
    [
      "quarter-way",
      { farthest: levelTiles / 4 },
      { farthest: levelTiles / 4 - 1 },
    ],
    ["halfway", { checkpoint: true }, { checkpoint: false }],
    [
      "three-quarters",
      { farthest: (levelTiles * 3) / 4 },
      { farthest: (levelTiles * 3) / 4 - 1 },
    ],
    ["first-coin", { coinsTaken: taking(1) }, { coinsTaken: taking(0) }],
    ["coins-10", { coinsTaken: taking(10) }, { coinsTaken: taking(9) }],
    ["coins-25", { coinsTaken: taking(25) }, { coinsTaken: taking(24) }],
    ["coins-50", { coinsTaken: taking(50) }, { coinsTaken: taking(49) }],
    ["first-stomp", { stomps: 1 }, { stomps: 0 }],
    ["stomps-5", { stomps: 5 }, { stomps: 4 }],
    ["stomps-10", { stomps: 10 }, { stomps: 9 }],
    ["combo-3", { bestCombo: 3 }, { bestCombo: 2 }],
    ["first-crate", { crates: 1 }, { crates: 0 }],
    ["crates-5", { crates: 5 }, { crates: 4 }],
  ] as const)(
    "%s is earned at its count and not one short",
    (id, enough, short) => {
      expect(earnedBy({ ...fresh, ...enough })).toContain(id);
      expect(earnedBy({ ...fresh, ...short })).not.toContain(id);
    },
  );

  it("counts the coins that were taken", () => {
    expect(coinsTaken({ ...fresh, coinsTaken: taking(7) })).toBe(7);
  });

  it("gives finish only to a hero who reached the goal", () => {
    expect(earnedBy(won())).toContain("finish");
    expect(earnedBy(fresh)).not.toContain("finish");
  });

  it("gives untouched to a finish with no hit and no fall, and not otherwise", () => {
    expect(earnedBy(won())).toContain("untouched");
    expect(earnedBy(won({ hits: 1 }))).not.toContain("untouched");
    expect(earnedBy(won({ deaths: 1 }))).not.toContain("untouched");
    expect(earnedBy({ ...fresh, finishTick: null })).not.toContain("untouched");
  });

  it("gives speedrun to a finish within the time, to the tick", () => {
    expect(earnedBy(won({ finishTick: speedrunTicks }))).toContain("speedrun");
    expect(earnedBy(won({ finishTick: speedrunTicks + 1 }))).not.toContain(
      "speedrun",
    );
  });

  it("gives pacifist to a finish with no stomp", () => {
    expect(earnedBy(won())).toContain("pacifist");
    expect(earnedBy(won({ stomps: 1 }))).not.toContain("pacifist");
    expect(earnedBy({ ...fresh, finishTick: null })).not.toContain("pacifist");
  });

  it("gives collector to a finish with every coin, and not one short", () => {
    const all = taking(fresh.coinsTaken.length);
    expect(earnedBy(won({ coinsTaken: all }))).toContain("collector");
    expect(earnedBy(won({ coinsTaken: taking(all.length - 1) }))).not.toContain(
      "collector",
    );
    expect(earnedBy({ ...fresh, coinsTaken: all })).not.toContain("collector");
  });

  it("gives last-life to a finish with one life left", () => {
    expect(earnedBy(won({ lives: 1 }))).toContain("last-life");
    expect(earnedBy(won({ lives: 2 }))).not.toContain("last-life");
    expect(earnedBy({ ...fresh, lives: 1 })).not.toContain("last-life");
  });

  it("puts the lantern where the level says", () => {
    expect(checkpointTile(fresh)).toBe(fresh.level.checkpointX / 256);
  });
});
