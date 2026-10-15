import { describe, expect, it } from "vitest";

import {
  gameMilestoneRecordSchema,
  mergeGameState,
  type GameState,
} from "../src/games/sync.ts";

const now = new Date("2026-10-12T12:00:00.000Z");
const only = (
  verification: "replay-verified" | "self-reported",
  unlockedAt: string,
  count = 1,
): GameState => ({
  counters: [],
  milestones: [{ count, id: "first-win", unlockedAt, verification }],
  progress: null,
});
const early = "2026-10-01T00:00:00.000Z";
const late = "2026-10-05T00:00:00.000Z";

describe("merging milestones that differ in how they are known", () => {
  it("keeps the verified level and its time from either side, even against an earlier reported time", () => {
    const verified = only("replay-verified", late);
    const reported = only("self-reported", early);
    for (const merged of [
      mergeGameState(verified, reported, now),
      mergeGameState(reported, verified, now),
    ])
      expect(merged.milestones).toEqual(verified.milestones);
  });

  it("takes the earliest time between two verified sides, and between two reported ones", () => {
    for (const level of ["replay-verified", "self-reported"] as const) {
      expect(
        mergeGameState(only(level, late), only(level, early), now).milestones,
      ).toEqual(only(level, early).milestones);
      expect(
        mergeGameState(only(level, early), only(level, late), now).milestones,
      ).toEqual(only(level, early).milestones);
    }
  });

  it("still takes the larger count, with the verified level", () => {
    expect(
      mergeGameState(
        only("replay-verified", late, 1),
        only("self-reported", early, 3),
        now,
      ).milestones,
    ).toEqual(only("replay-verified", late, 3).milestones);
  });

  it("is the same when merged again", () => {
    const once = mergeGameState(
      only("replay-verified", late),
      only("self-reported", early),
      now,
    );
    expect(mergeGameState(once, only("self-reported", early), now)).toEqual(
      once,
    );
  });
});

describe("a milestone record's level", () => {
  it("is one of the two the manifest names, and nothing else", () => {
    const record = { count: 1, id: "first-win", unlockedAt: early };
    for (const verification of ["self-reported", "replay-verified"])
      expect(
        gameMilestoneRecordSchema.safeParse({ ...record, verification })
          .success,
      ).toBe(true);
    for (const verification of ["verified", "", "Replay-Verified"])
      expect(
        gameMilestoneRecordSchema.safeParse({ ...record, verification })
          .success,
      ).toBe(false);
  });
});
