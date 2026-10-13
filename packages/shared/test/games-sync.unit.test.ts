import { describe, expect, it } from "vitest";

import { gameManifestLimits } from "../src/games/manifest.ts";
import {
  gameClockSkewMs,
  mergeGameState,
  syncGameStateInputSchema,
  type GameState,
} from "../src/games/sync.ts";

const now = new Date("2026-10-12T12:00:00.000Z");
const progress = (savedAt: string, state: number) => ({ savedAt, state });
const milestone = (id: string, unlockedAt: string, count = 1) => ({
  count,
  id,
  unlockedAt,
  verification: "self-reported" as const,
});
const empty: GameState = { counters: [], milestones: [], progress: null };

describe("merging a game's state", () => {
  it("keeps the newer save, whichever side holds it", () => {
    const older = { ...empty, progress: progress("2026-10-01T00:00:00Z", 1) };
    const newer = { ...empty, progress: progress("2026-10-02T00:00:00Z", 2) };
    expect(mergeGameState(older, newer, now).progress?.state).toBe(2);
    expect(mergeGameState(newer, older, now).progress?.state).toBe(2);
  });

  it("keeps the stored save on a tie, so a replay changes nothing", () => {
    const stored = { ...empty, progress: progress("2026-10-01T00:00:00Z", 1) };
    const incoming = {
      ...empty,
      progress: progress("2026-10-01T00:00:00Z", 9),
    };
    expect(mergeGameState(stored, incoming, now).progress?.state).toBe(1);
  });

  it("takes a save when none is stored, and keeps the stored one when none arrives", () => {
    const saved = { ...empty, progress: progress("2026-10-01T00:00:00Z", 1) };
    expect(mergeGameState(empty, saved, now).progress?.state).toBe(1);
    expect(mergeGameState(saved, empty, now).progress?.state).toBe(1);
    expect(mergeGameState(empty, empty, now).progress).toBeNull();
  });

  it("ignores a save dated beyond the clock skew, so it cannot outrank real saves or move on a replay", () => {
    const stored = { ...empty, progress: progress("2026-10-12T11:00:00Z", 1) };
    const forged = {
      ...empty,
      progress: progress("2099-01-01T00:00:00Z", 666),
    };
    expect(mergeGameState(stored, forged, now)).toEqual(stored);
    expect(mergeGameState(empty, forged, now).progress).toBeNull();
  });

  it("accepts a save dated within the skew, as it is, and the same save again changes nothing", () => {
    const ahead = new Date(now.getTime() + gameClockSkewMs).toISOString();
    const saved = { ...empty, progress: progress(ahead, 2) };
    const once = mergeGameState(empty, saved, now);
    expect(once.progress?.savedAt).toBe(ahead);
    expect(
      mergeGameState(once, saved, new Date(now.getTime() + 1_000)),
    ).toEqual(once);
    const beyond = new Date(now.getTime() + gameClockSkewMs + 1).toISOString();
    expect(
      mergeGameState(empty, { ...empty, progress: progress(beyond, 3) }, now)
        .progress,
    ).toBeNull();
  });

  it("takes the skew as a parameter", () => {
    const saved = { ...empty, progress: progress("2026-10-12T12:00:30Z", 1) };
    expect(mergeGameState(empty, saved, now, 0).progress).toBeNull();
    expect(mergeGameState(empty, saved, now, 60_000).progress).not.toBeNull();
  });

  it("keeps every milestone from both sides with the earliest unlock, sorted by id", () => {
    const stored: GameState = {
      counters: [],
      milestones: [
        milestone("ten-taps", "2026-10-03T00:00:00Z"),
        milestone("first-five", "2026-10-02T00:00:00Z"),
      ],
      progress: null,
    };
    const incoming: GameState = {
      counters: [],
      milestones: [
        milestone("first-five", "2026-10-01T00:00:00Z"),
        milestone("a-new-one", "2026-10-04T00:00:00Z"),
        milestone("ten-taps", "2026-10-09T00:00:00Z"),
      ],
      progress: null,
    };
    expect(mergeGameState(stored, incoming, now).milestones).toEqual([
      milestone("a-new-one", "2026-10-04T00:00:00Z"),
      milestone("first-five", "2026-10-01T00:00:00Z"),
      milestone("ten-taps", "2026-10-03T00:00:00Z"),
    ]);
  });

  it("does not date an unlock in the future, and keeps that date when the unlock is replayed later", () => {
    const incoming: GameState = {
      counters: [],
      milestones: [milestone("first-five", "2099-01-01T00:00:00Z")],
      progress: null,
    };
    const first = mergeGameState(empty, incoming, now);
    expect(first.milestones[0]?.unlockedAt).toBe(now.toISOString());
    const later = new Date(now.getTime() + 60_000);
    expect(mergeGameState(first, incoming, later)).toEqual(first);
  });

  it("keeps the larger count of a milestone from either side, with the earliest time", () => {
    const stored = {
      ...empty,
      milestones: [milestone("win", "2026-10-02T00:00:00Z", 5)],
    };
    const incoming = {
      ...empty,
      milestones: [milestone("win", "2026-10-03T00:00:00Z", 3)],
    };
    expect(mergeGameState(stored, incoming, now).milestones).toEqual([
      milestone("win", "2026-10-02T00:00:00Z", 5),
    ]);
    expect(mergeGameState(incoming, stored, now).milestones).toEqual([
      milestone("win", "2026-10-02T00:00:00Z", 5),
    ]);
    const later = {
      ...empty,
      milestones: [milestone("win", "2026-10-01T00:00:00Z", 2)],
    };
    expect(mergeGameState(stored, later, now).milestones).toEqual([
      milestone("win", "2026-10-01T00:00:00Z", 5),
    ]);
  });

  it("keeps the larger progress total of each counter from either side, sorted by id", () => {
    const stored = {
      ...empty,
      counters: [
        { current: 7, id: "wins" },
        { current: 1, id: "coins" },
      ],
    };
    const incoming = {
      ...empty,
      counters: [
        { current: 4, id: "wins" },
        { current: 9, id: "coins" },
        { current: 2, id: "a-new" },
      ],
    };
    expect(mergeGameState(stored, incoming, now).counters).toEqual([
      { current: 2, id: "a-new" },
      { current: 9, id: "coins" },
      { current: 7, id: "wins" },
    ]);
  });

  it("never lowers a total: a replayed older report changes nothing", () => {
    const stored = { ...empty, counters: [{ current: 7, id: "wins" }] };
    const older = { ...empty, counters: [{ current: 3, id: "wins" }] };
    expect(mergeGameState(stored, older, now)).toEqual(stored);
  });

  it("is idempotent: merging a result with the same input again changes nothing", () => {
    const incoming: GameState = {
      counters: [],
      milestones: [milestone("first-five", "2026-10-01T00:00:00Z")],
      progress: progress("2026-10-01T00:00:00Z", 1),
    };
    const once = mergeGameState(empty, incoming, now);
    expect(mergeGameState(once, incoming, now)).toEqual(once);
  });
});

describe("the sync request", () => {
  const valid = { gameId: "tap-tower", state: empty };

  it("accepts a state and refuses extra fields, a bad game id and a milestone that is not self-reported", () => {
    expect(syncGameStateInputSchema.safeParse(valid).success).toBe(true);
    expect(
      syncGameStateInputSchema.safeParse({ ...valid, extra: 1 }).success,
    ).toBe(false);
    expect(
      syncGameStateInputSchema.safeParse({ ...valid, gameId: "../x" }).success,
    ).toBe(false);
    expect(
      syncGameStateInputSchema.safeParse({
        ...valid,
        state: {
          milestones: [
            {
              ...milestone("a-b", "2026-10-01T00:00:00Z"),
              verification: "verified",
            },
          ],
          progress: null,
        },
      }).success,
    ).toBe(false);
  });
});

describe("counts and counters in a state", () => {
  const valid = { gameId: "tap-tower", state: empty };

  it.each([
    [
      "a count of nothing",
      {
        counters: [],
        milestones: [{ ...milestone("win", "2026-10-01T00:00:00Z"), count: 0 }],
        progress: null,
      },
    ],
    [
      "a fractional count",
      {
        counters: [],
        milestones: [
          { ...milestone("win", "2026-10-01T00:00:00Z"), count: 1.5 },
        ],
        progress: null,
      },
    ],
    [
      "a count without a limit",
      {
        counters: [],
        milestones: [
          { ...milestone("win", "2026-10-01T00:00:00Z"), count: 1_000_001 },
        ],
        progress: null,
      },
    ],
    [
      "a negative total",
      {
        counters: [{ current: -1, id: "wins" }],
        milestones: [],
        progress: null,
      },
    ],
    [
      "a fractional total",
      {
        counters: [{ current: 0.5, id: "wins" }],
        milestones: [],
        progress: null,
      },
    ],
    [
      "a counter with an extra field",
      {
        counters: [{ current: 1, id: "wins", target: 5 }],
        milestones: [],
        progress: null,
      },
    ],
    ["no counters at all", { milestones: [], progress: null }],
  ])("refuses %s", (_why, state) => {
    expect(
      syncGameStateInputSchema.safeParse({ ...valid, state }).success,
    ).toBe(false);
  });

  it("accepts the largest count and total the manifest allows", () => {
    const state = {
      counters: [{ current: gameManifestLimits.milestoneCount, id: "wins" }],
      milestones: [
        {
          ...milestone("win", "2026-10-01T00:00:00Z"),
          count: gameManifestLimits.milestoneCount,
        },
      ],
      progress: null,
    };
    expect(
      syncGameStateInputSchema.safeParse({ ...valid, state }).success,
    ).toBe(true);
  });
});
