import { describe, expect, it } from "vitest";

import { earnedBy, milestoneIds, milestones } from "../src/rules/milestones.ts";
import type { TowerState } from "../src/rules/types.ts";
import { tower } from "./support/states.ts";

// Each milestone, with what just earns it and what falls just short, so a threshold that moves is caught.
const cases: readonly [string, Partial<TowerState>, Partial<TowerState>][] = [
  ["first-block", { height: 1 }, { height: 0 }],
  ["ten-high", { height: 10 }, { height: 9 }],
  ["quarter-hundred", { height: 25 }, { height: 24 }],
  ["fifty-high", { height: 50 }, { height: 49 }],
  ["century", { height: 100 }, { height: 99 }],
  ["skyline", { height: 200 }, { height: 199 }],
  ["first-perfect", { perfects: 1 }, { perfects: 0 }],
  ["perfect-ten", { perfects: 10 }, { perfects: 9 }],
  ["perfect-fifty", { perfects: 50 }, { perfects: 49 }],
  ["triple", { bestStreak: 3 }, { bestStreak: 2 }],
  ["five-streak", { bestStreak: 5 }, { bestStreak: 4 }],
  ["ten-streak", { bestStreak: 10 }, { bestStreak: 9 }],
  ["twenty-streak", { bestStreak: 20 }, { bestStreak: 19 }],
  ["double-five", { fives: 2 }, { fives: 1 }],
  ["regrown", { regrown: true }, { regrown: false }],
  ["needle", { needle: true }, { needle: false }],
  ["wide-load", { wideLoad: true }, { wideLoad: false }],
  ["tidy-tower", { tidy: true }, { tidy: false }],
  ["by-a-hair", { byHair: true }, { byHair: false }],
  ["marathon", { marathon: true }, { marathon: false }],
];

describe("the milestones", () => {
  it("are twenty, each named once", () => {
    expect(milestoneIds).toHaveLength(20);
    expect(new Set(milestoneIds).size).toBe(20);
    expect(cases.map(([id]) => id).sort()).toEqual([...milestoneIds].sort());
  });

  it.each(cases)(
    "%s is earned at its mark and not just short of it",
    (id, at, short) => {
      expect(earnedBy(tower(at))).toContain(id);
      expect(earnedBy(tower(short))).not.toContain(id);
    },
  );

  it("are none for a tower with nothing yet, and come in the order they are listed", () => {
    expect(earnedBy(tower())).toEqual([]);
    const all = earnedBy(
      tower({
        bestStreak: 20,
        byHair: true,
        fives: 2,
        height: 200,
        marathon: true,
        needle: true,
        perfects: 50,
        regrown: true,
        tidy: true,
        wideLoad: true,
      }),
    );
    expect(all).toEqual(milestones.map(({ id }) => id));
  });
});
