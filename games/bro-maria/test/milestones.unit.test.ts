import { describe, expect, it } from "vitest";

import {
  levelTiles,
  lightningTicks,
  speed60Ticks,
  speedrunTicks,
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
  finishTick: 2_500,
  lives: 3,
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
    ["tile-25", { farthest: 25 }, { farthest: 24 }],
    ["tile-75", { farthest: 75 }, { farthest: 74 }],
    ["tile-125", { farthest: 125 }, { farthest: 124 }],
    ["tile-175", { farthest: 175 }, { farthest: 174 }],
    ["coins-5", { coinsTaken: taking(5) }, { coinsTaken: taking(4) }],
    ["coins-40", { coinsTaken: taking(40) }, { coinsTaken: taking(39) }],
    ["coins-65", { coinsTaken: taking(65) }, { coinsTaken: taking(64) }],
    ["stomps-3", { stomps: 3 }, { stomps: 2 }],
    ["stomps-8", { stomps: 8 }, { stomps: 7 }],
    ["combo-2", { bestCombo: 2 }, { bestCombo: 1 }],
    ["crates-3", { crates: 3 }, { crates: 2 }],
    ["crates-8", { crates: 8 }, { crates: 7 }],
    ["clean-start", { farthest: 100 }, { farthest: 99 }],
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

  it("gives clean-start only to a hero who has not been hit or fallen", () => {
    expect(earnedBy({ ...fresh, farthest: 120, hits: 1 })).not.toContain(
      "clean-start",
    );
    expect(earnedBy({ ...fresh, farthest: 120, deaths: 1 })).not.toContain(
      "clean-start",
    );
  });

  it("gives exterminator when every slime in the level has been stomped, and not one short", () => {
    const all = fresh.level.patrols.length;
    expect(earnedBy({ ...fresh, stomps: all })).toContain("exterminator");
    expect(earnedBy({ ...fresh, stomps: all - 1 })).not.toContain(
      "exterminator",
    );
  });

  it("gives tasting-menu for a bit of everything", () => {
    const some = { coinsTaken: taking(10), crates: 1, stomps: 1 };
    expect(earnedBy({ ...fresh, ...some })).toContain("tasting-menu");
    for (const lacking of [
      { crates: 0 },
      { stomps: 0 },
      { coinsTaken: taking(9) },
    ])
      expect(earnedBy({ ...fresh, ...some, ...lacking })).not.toContain(
        "tasting-menu",
      );
  });

  it("gives all-rounder to a finish with 25 shards, 5 stomps and 3 crates, and not one short of any", () => {
    const enough = { coinsTaken: taking(25), crates: 3, stomps: 5 };
    expect(earnedBy(won(enough))).toContain("all-rounder");
    for (const lacking of [
      { crates: 2 },
      { stomps: 4 },
      { coinsTaken: taking(24) },
    ])
      expect(earnedBy(won({ ...enough, ...lacking }))).not.toContain(
        "all-rounder",
      );
    expect(earnedBy({ ...fresh, ...enough })).not.toContain("all-rounder");
  });

  it("gives pit-proof to a finish with no fall, second-wind to a finish after a hit or a fall, and neither to an unfinished run", () => {
    expect(earnedBy(won({ hits: 2 }))).toContain("pit-proof");
    expect(earnedBy(won({ deaths: 1 }))).not.toContain("pit-proof");
    expect(earnedBy(won())).not.toContain("second-wind");
    expect(earnedBy(won({ hits: 1 }))).toContain("second-wind");
    expect(earnedBy(won({ deaths: 1 }))).toContain("second-wind");
    expect(earnedBy({ ...fresh, deaths: 1 })).not.toContain("second-wind");
    expect(earnedBy(fresh)).not.toContain("pit-proof");
  });

  it("gives speed-60 and lightning to a finish within their times, to the tick", () => {
    expect(earnedBy(won({ finishTick: speed60Ticks }))).toContain("speed-60");
    expect(earnedBy(won({ finishTick: speed60Ticks + 1 }))).not.toContain(
      "speed-60",
    );
    expect(earnedBy(won({ finishTick: lightningTicks }))).toContain(
      "lightning",
    );
    expect(earnedBy(won({ finishTick: lightningTicks + 1 }))).not.toContain(
      "lightning",
    );
    expect(earnedBy({ ...fresh, finishTick: null })).not.toContain("speed-60");
  });

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
