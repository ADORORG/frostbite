import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  pool: vi.fn(() => ({ pool: true })),
  rank: vi.fn(),
  players: vi.fn(),
  top: vi.fn(),
}));

vi.mock("@frostbite/database/connection", () => ({
  createDatabaseClient: (pool: unknown) => ({ client: pool }),
  createDatabasePool: calls.pool,
  parseDatabaseEnvironment: () => ({ parsed: true }),
}));
vi.mock("@frostbite/game-runs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@frostbite/game-runs")>()),
  playersOnBoard: calls.players,
  rankOf: calls.rank,
  topScores: calls.top,
}));

import { createLeaderboardResolver } from "../src/leaderboard-runtime.ts";

// A Wednesday: its week began on Monday the 9th and ends on the 16th, and its month ends on 1 December.
const clock = () => new Date("2026-11-11T15:00:00.000Z");
const row = (
  rank: number,
  profile: { avatar: string; name: string } | null,
) => ({
  achievedAt: new Date("2026-11-10T10:00:00.000Z"),
  profile,
  rank,
  score: 1000 - rank,
  userId: `user-${String(rank)}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  calls.players.mockResolvedValue(7);
  calls.top.mockResolvedValue([
    row(1, { avatar: "snowman", name: "Ada" }),
    row(1, { avatar: "not-a-picture", name: "Drifted" }),
    row(3, null),
  ]);
});

describe("the boards read from the database", () => {
  it("asks for the period the clock is in, and answers the entries, the player count and when the period ends, with no user id", async () => {
    const boards = await createLeaderboardResolver(clock, {})();
    const answer = await boards.top("arcade", "week");
    expect(calls.top).toHaveBeenCalledWith(
      { client: { pool: true } },
      { gameId: "arcade", kind: "week", start: "2026-11-09" },
      25,
    );
    expect(calls.players).toHaveBeenCalledWith(
      { client: { pool: true } },
      { gameId: "arcade", kind: "week", start: "2026-11-09" },
    );
    expect(answer.endsAt).toEqual(new Date("2026-11-16T00:00:00.000Z"));
    expect(answer.players).toBe(7);
    expect(answer.entries[0]).toEqual({
      achievedAt: "2026-11-10T10:00:00.000Z",
      profile: { avatar: "snowman", name: "Ada" },
      rank: 1,
      score: 999,
    });
    // Players who share a score share a rank, and the one after them is not 2.
    expect(answer.entries.map(({ rank }) => rank)).toEqual([1, 1, 3]);
    expect(JSON.stringify(answer)).not.toContain("user-");
    expect((await boards.top("arcade", "month")).endsAt).toEqual(
      new Date("2026-12-01T00:00:00.000Z"),
    );
    expect((await boards.top("arcade", "all")).endsAt).toBeNull();
  });

  it("shows a picture the platform no longer offers as no profile, not as a broken one", async () => {
    const answer = await (
      await createLeaderboardResolver(clock, {})()
    ).top("arcade", "all");
    expect(answer.entries.map(({ profile }) => profile?.name ?? null)).toEqual([
      "Ada",
      null,
      null,
    ]);
  });

  it("reads one player's place in the same period, and opens one pool however many reads follow", async () => {
    calls.rank.mockResolvedValue({ rank: 4, score: 900 });
    const resolve = createLeaderboardResolver(clock, {});
    const boards = await resolve();
    expect(await boards.mine("arcade", "month", "u1")).toEqual({
      rank: 4,
      score: 900,
    });
    expect(calls.rank).toHaveBeenCalledWith(
      { client: { pool: true } },
      { gameId: "arcade", kind: "month", start: "2026-11-01" },
      "u1",
    );
    await resolve();
    await boards.top("arcade", "all");
    expect(calls.pool).toHaveBeenCalledTimes(1);
  });
});
