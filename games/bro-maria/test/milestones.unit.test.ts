import { describe, expect, it } from "vitest";

import {
  lightningTicks,
  maxLives,
  stages,
  swiftTicks,
} from "../src/rules/constants.ts";
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
  cleanStages: stages,
  finishTick: 14_000,
  lives: 3,
  stage: stages,
  stagesCleared: stages,
  ...over,
});

describe("the marks", () => {
  it("are forty, each named once", () => {
    expect(milestoneIds).toHaveLength(40);
    expect(new Set(milestoneIds).size).toBe(40);
  });

  it("start with none earned", () => {
    expect(earnedBy(fresh)).toEqual([]);
  });

  it.each([
    ["first-steps", { farthest: 10 }, { farthest: 9 }],
    ["tile-100", { farthest: 100 }, { farthest: 99 }],
    ["halfway", { checkpoint: true }, { checkpoint: false }],
    ["stage-2", { stagesCleared: 1 }, { stagesCleared: 0 }],
    ["stage-3", { stagesCleared: 2 }, { stagesCleared: 1 }],
    ["stage-4", { stagesCleared: 3 }, { stagesCleared: 2 }],
    ["stage-5", { stagesCleared: 4 }, { stagesCleared: 3 }],
    ["stage-6", { stagesCleared: 5 }, { stagesCleared: 4 }],
    ["first-coin", { coinsBanked: 1 }, { coinsBanked: 0 }],
    ["coins-10", { coinsBanked: 10 }, { coinsBanked: 9 }],
    ["coins-25", { coinsBanked: 25 }, { coinsBanked: 24 }],
    ["coins-50", { coinsBanked: 50 }, { coinsBanked: 49 }],
    ["coins-100", { coinsBanked: 100 }, { coinsBanked: 99 }],
    ["coins-175", { coinsBanked: 175 }, { coinsBanked: 174 }],
    ["coins-250", { coinsBanked: 250 }, { coinsBanked: 249 }],
    ["first-stomp", { stomps: 1 }, { stomps: 0 }],
    ["stomps-5", { stomps: 5 }, { stomps: 4 }],
    ["stomps-10", { stomps: 10 }, { stomps: 9 }],
    ["stomps-20", { stomps: 20 }, { stomps: 19 }],
    ["stomps-40", { stomps: 40 }, { stomps: 39 }],
    ["stomps-70", { stomps: 70 }, { stomps: 69 }],
    ["stomps-100", { stomps: 100 }, { stomps: 99 }],
    ["combo-2", { bestCombo: 2 }, { bestCombo: 1 }],
    ["combo-3", { bestCombo: 3 }, { bestCombo: 2 }],
    ["first-crate", { crates: 1 }, { crates: 0 }],
    ["crates-5", { crates: 5 }, { crates: 4 }],
    ["crates-12", { crates: 12 }, { crates: 11 }],
    ["crates-24", { crates: 24 }, { crates: 23 }],
    ["clean-stage", { cleanStages: 1 }, { cleanStages: 0 }],
    ["clean-stages-3", { cleanStages: 3 }, { cleanStages: 2 }],
    ["five-lives", { lives: maxLives }, { lives: maxLives - 1 }],
    ["swift", { fastest: swiftTicks }, { fastest: swiftTicks + 1 }],
    ["lightning", { fastest: lightningTicks }, { fastest: lightningTicks + 1 }],
    ["collector", { perfectStages: 1 }, { perfectStages: 0 }],
    ["collector-3", { perfectStages: 3 }, { perfectStages: 2 }],
  ] as const)(
    "%s is earned at its count and not one short",
    (id, enough, short) => {
      expect(earnedBy({ ...fresh, ...enough })).toContain(id);
      expect(earnedBy({ ...fresh, ...short })).not.toContain(id);
    },
  );

  it("counts the shards of the stages cleared and of the stage being played together", () => {
    expect(
      coinsTaken({ ...fresh, coinsBanked: 40, coinsTaken: taking(7) }),
    ).toBe(47);
    expect(
      earnedBy({ ...fresh, coinsBanked: 45, coinsTaken: taking(5) }),
    ).toContain("coins-50");
    expect(
      earnedBy({ ...fresh, coinsBanked: 45, coinsTaken: taking(4) }),
    ).not.toContain("coins-50");
  });

  it("counts the first stage's marks of distance for the stage being played, and for every stage after it", () => {
    expect(earnedBy({ ...fresh, farthest: 2, stage: 2 })).toEqual(
      expect.arrayContaining(["first-steps", "tile-100", "halfway"]),
    );
    expect(earnedBy({ ...fresh, farthest: 2, stage: 1 })).toEqual([]);
  });

  it("gives tasting-menu for a bit of everything", () => {
    const some = { coinsBanked: 10, crates: 1, stomps: 1 };
    expect(earnedBy({ ...fresh, ...some })).toContain("tasting-menu");
    for (const lacking of [{ crates: 0 }, { stomps: 0 }, { coinsBanked: 9 }])
      expect(earnedBy({ ...fresh, ...some, ...lacking })).not.toContain(
        "tasting-menu",
      );
  });

  it("gives finish only to a hero who cleared the last stage", () => {
    expect(earnedBy(won())).toContain("finish");
    expect(earnedBy({ ...won(), finishTick: null })).not.toContain("finish");
    expect(earnedBy(fresh)).not.toContain("finish");
  });

  it("gives flawless to a finish in which every stage was clean, and not one short", () => {
    expect(earnedBy(won())).toContain("flawless");
    expect(earnedBy(won({ cleanStages: stages - 1 }))).not.toContain(
      "flawless",
    );
    expect(
      earnedBy({ ...won({ cleanStages: stages }), finishTick: null }),
    ).not.toContain("flawless");
  });

  it("gives pit-proof to a finish with no fall, and last-life to a finish with one life left", () => {
    expect(earnedBy(won({ hits: 5 }))).toContain("pit-proof");
    expect(earnedBy(won({ deaths: 1 }))).not.toContain("pit-proof");
    expect(earnedBy({ ...fresh, deaths: 0 })).not.toContain("pit-proof");
    expect(earnedBy(won({ lives: 1 }))).toContain("last-life");
    expect(earnedBy(won({ lives: 2 }))).not.toContain("last-life");
    expect(earnedBy({ ...fresh, lives: 1 })).not.toContain("last-life");
  });

  it("puts the lantern where the level says", () => {
    expect(checkpointTile(fresh)).toBe(fresh.level.checkpointX / 256);
  });
});
