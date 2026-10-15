import { describe, expect, it } from "vitest";

import {
  gameRunSeedMax,
  startGameRunInputSchema,
  startGameRunResponseSchema,
  submitGameRunInputSchema,
  submitGameRunResponseSchema,
} from "../src/games/runs.ts";

const runId = "0198a000-0000-7000-8000-000000000001";

describe("the run contracts", () => {
  it("takes a game id and nothing else to start a run", () => {
    expect(
      startGameRunInputSchema.safeParse({ gameId: "frostbite" }).success,
    ).toBe(true);
    for (const bad of [
      {},
      { gameId: "Bad Id" },
      { extra: 1, gameId: "frostbite" },
    ])
      expect(startGameRunInputSchema.safeParse(bad).success).toBe(false);
  });

  it("answers a start with a run id, a 32-bit seed and an expiry, or with why there is none", () => {
    const ok = {
      expiresAt: "2026-10-16T12:00:00.000Z",
      runId,
      seed: gameRunSeedMax,
      status: "started",
    };
    expect(startGameRunResponseSchema.safeParse(ok).success).toBe(true);
    expect(
      startGameRunResponseSchema.safeParse({ ...ok, seed: 0 }).success,
    ).toBe(true);
    for (const seed of [-1, gameRunSeedMax + 1, 1.5])
      expect(
        startGameRunResponseSchema.safeParse({ ...ok, seed }).success,
      ).toBe(false);
    for (const reason of ["not-supported", "too-many-open-runs"])
      expect(
        startGameRunResponseSchema.safeParse({ reason, status: "unavailable" })
          .success,
      ).toBe(true);
    for (const bad of [
      { reason: "other", status: "unavailable" },
      { status: "unavailable" },
      { ...ok, reason: "not-supported" },
    ])
      expect(startGameRunResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("takes any JSON as the record, a run id that is a uuid, and no extra fields", () => {
    const ok = {
      gameId: "frostbite",
      record: { any: ["json", 1, null] },
      runId,
    };
    expect(submitGameRunInputSchema.safeParse(ok).success).toBe(true);
    expect(
      submitGameRunInputSchema.safeParse({ ...ok, record: "text" }).success,
    ).toBe(true);
    for (const bad of [
      { ...ok, runId: "run-1" },
      { ...ok, extra: true },
      { gameId: "frostbite", runId },
    ])
      expect(submitGameRunInputSchema.safeParse(bad).success).toBe(false);
  });

  it("answers a submission as verified with what it earned, rejected with why, or refused with why", () => {
    const answers = [
      { earned: ["first-win"], status: "verified" },
      { earned: [], status: "verified" },
      { reason: "illegal-input", status: "rejected" },
      { reason: "stale", status: "refused" },
      { reason: "unknown-run", status: "refused" },
    ];
    for (const answer of answers)
      expect(submitGameRunResponseSchema.safeParse(answer).success).toBe(true);
    for (const bad of [
      { reason: null, status: "rejected" },
      { reason: "", status: "rejected" },
      { reason: "elsewhere", status: "refused" },
      { earned: ["x"], reason: "stale", status: "refused" },
      { earned: [], status: "pending" },
      { status: "verified" },
    ])
      expect(submitGameRunResponseSchema.safeParse(bad).success).toBe(false);
  });
});
