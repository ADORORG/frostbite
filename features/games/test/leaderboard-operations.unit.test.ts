import {
  getLeaderboardResponseSchema,
  getMyRankResponseSchema,
  leaderboardSize,
} from "@frostbite/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createGetLeaderboardOperation,
  createGetMyRankOperation,
  leaderboardCache,
  type Leaderboards,
} from "../src/application/leaderboard-operations.ts";

const scored = new Set(["arcade"]);
const entry = (rank: number) => ({
  achievedAt: "2026-11-03T10:00:00.000Z",
  profile: null,
  rank,
  score: 100 - rank,
});
const boards = (over: Partial<Leaderboards> = {}): Leaderboards => ({
  mine: vi.fn(async () => ({ rank: 3, score: 40 })),
  top: vi.fn(async () => ({
    endsAt: new Date("2026-11-09T00:00:00.000Z"),
    entries: [entry(1), entry(2)],
    players: 9,
  })),
  ...over,
});
const context = (actorUserId: string | null) =>
  ({ actorUserId }) as Parameters<
    ReturnType<typeof createGetMyRankOperation>["execute"]
  >[1];

describe("the public leaderboard of a game", () => {
  it("is public and cached for a minute, and answers in the contract's shape with the end of the period", async () => {
    const operation = createGetLeaderboardOperation(
      async () => boards(),
      scored,
    );
    expect(operation.access).toEqual({ kind: "public" });
    expect(operation.cache).toBe(leaderboardCache);
    expect(leaderboardCache.seconds).toBe(60);
    const answer = await operation.execute({
      gameId: "arcade",
      window: "week",
    });
    expect(answer).toMatchObject({
      ok: true,
      value: { endsAt: "2026-11-09T00:00:00.000Z", players: 9 },
    });
    expect(
      getLeaderboardResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
  });

  it("has no end for all time, and never more places than the board holds", async () => {
    const many = Array.from({ length: leaderboardSize + 5 }, (_, i) =>
      entry(i + 1),
    );
    const operation = createGetLeaderboardOperation(
      async () =>
        boards({
          top: vi.fn(async () => ({
            endsAt: null,
            entries: many,
            players: 30,
          })),
        }),
      scored,
    );
    const answer = await operation.execute({ gameId: "arcade", window: "all" });
    expect(answer).toMatchObject({ value: { endsAt: null } });
    expect(answer.ok ? answer.value.entries : []).toHaveLength(leaderboardSize);
  });

  it("is not found for a game the platform does not replay, and reads nothing", async () => {
    const source = boards();
    const operation = createGetLeaderboardOperation(async () => source, scored);
    expect(
      (await operation.execute({ gameId: "other", window: "all" })).ok,
    ).toBe(false);
    expect(source.top).not.toHaveBeenCalled();
  });
});

describe("the place of the signed-in player", () => {
  it("is asked for the session's own player, never one named in the request", async () => {
    const source = boards();
    const operation = createGetMyRankOperation(async () => source, scored);
    expect(operation.access).toEqual({ kind: "authenticated" });
    const answer = await operation.execute(
      { gameId: "arcade", window: "month" },
      context("u1"),
    );
    expect(answer).toEqual({
      ok: true,
      value: { place: { rank: 3, score: 40 } },
    });
    expect(
      getMyRankResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
    expect(source.mine).toHaveBeenCalledWith("arcade", "month", "u1");
  });

  it("is a null place for a player with no score, refuses no session, and is not found for a game with no board", async () => {
    const source = boards({ mine: vi.fn(async () => null) });
    const operation = createGetMyRankOperation(async () => source, scored);
    expect(
      await operation.execute(
        { gameId: "arcade", window: "all" },
        context("u1"),
      ),
    ).toEqual({ ok: true, value: { place: null } });
    expect(
      (
        await operation.execute(
          { gameId: "arcade", window: "all" },
          context(null),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await operation.execute(
          { gameId: "other", window: "all" },
          context("u1"),
        )
      ).ok,
    ).toBe(false);
    expect(source.mine).toHaveBeenCalledTimes(1);
  });
});
