import { randomUUID } from "node:crypto";

import { authUsers, gameRuns } from "@frostbite/database";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  playersOnBoard,
  rankOf,
  topScores,
  windowEndsAt,
  windowStartOf,
} from "../src/leaderboard.ts";
import { at, freshGame, rowOf, runBackfill, settle } from "./support/board.ts";
import {
  database,
  digest,
  registerDatabase,
  seedUser,
} from "./support/database.ts";

registerDatabase();

describe("the periods a board is kept for", () => {
  it.each([
    ["2026-11-08T12:00:00.000Z", "2026-11-01", "2026-11-02"],
    ["2026-11-01T00:00:00.000Z", "2026-11-01", "2026-10-26"],
    ["2026-11-02T00:00:00.000Z", "2026-11-01", "2026-11-02"],
    ["2026-11-01T23:59:59.999Z", "2026-11-01", "2026-10-26"],
    ["2026-11-30T23:59:59.999Z", "2026-11-01", "2026-11-30"],
    ["2026-12-01T00:00:00.000Z", "2026-12-01", "2026-11-30"],
    ["2027-01-01T00:00:00.000Z", "2027-01-01", "2026-12-28"],
  ])(
    "agree with the database at %s: month %s, week %s",
    async (when, month, week) => {
      const [userId, gameId] = [await seedUser(), freshGame()];
      await settle(userId, gameId, 5, when);
      expect(windowStartOf("all", at(when))).toBe("1970-01-01");
      expect(windowStartOf("month", at(when))).toBe(month);
      expect(windowStartOf("week", at(when))).toBe(week);
      for (const [kind, start] of [
        ["all", "1970-01-01"],
        ["month", month],
        ["week", week],
      ] as const)
        expect((await rowOf(gameId, kind, userId))[0]?.windowStart).toBe(start);
    },
  );

  it("end when the next begins, and all time never ends", () => {
    expect(windowEndsAt("week", "2026-11-02")?.toISOString()).toBe(
      "2026-11-09T00:00:00.000Z",
    );
    expect(windowEndsAt("month", "2026-12-01")?.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(windowEndsAt("all", "1970-01-01")).toBeNull();
  });
});

describe("the best scores kept as runs settle", () => {
  it("keeps the higher score of a player in each period, and the earlier run when a score is matched", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    await settle(userId, gameId, 100, "2026-11-03T10:00:00.000Z");
    await settle(userId, gameId, 40, "2026-11-04T10:00:00.000Z");
    await settle(userId, gameId, 100, "2026-11-05T10:00:00.000Z");
    expect(await rowOf(gameId, "all", userId)).toEqual([
      {
        achievedAt: at("2026-11-03T10:00:00.000Z"),
        score: 100,
        windowStart: "1970-01-01",
      },
    ]);
    await settle(userId, gameId, 150, "2026-11-06T10:00:00.000Z");
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({
      score: 150,
    });
  });

  it("keeps a score of zero, and ignores a run that was rejected or has no score", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    await settle(userId, gameId, null, "2026-11-03T10:00:00.000Z");
    await settle(userId, gameId, null, "2026-11-03T11:00:00.000Z", "rejected");
    expect(await rowOf(gameId, "all", userId)).toEqual([]);
    await settle(userId, gameId, 0, "2026-11-03T12:00:00.000Z");
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({ score: 0 });
  });

  it("keeps each period as it ended: a lower score in a later week starts that week without touching the earlier one", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    await settle(userId, gameId, 900, "2026-11-03T10:00:00.000Z");
    await settle(userId, gameId, 300, "2026-11-10T10:00:00.000Z");
    const weeks = await rowOf(gameId, "week", userId);
    expect(
      weeks.map(({ score, windowStart }) => [windowStart, score]).sort(),
    ).toEqual([
      ["2026-11-02", 900],
      ["2026-11-09", 300],
    ]);
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({
      score: 900,
    });
    expect((await rowOf(gameId, "month", userId))[0]).toMatchObject({
      score: 900,
    });
  });

  it("follows a run that becomes verified with a score after it was stored", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    const id = randomUUID();
    await database.insert(gameRuns).values({
      expiresAt: at("2030-01-01T00:00:00.000Z"),
      gameId,
      id,
      issuedAt: at("2026-01-01T00:00:00.000Z"),
      seed: 1,
      userId,
      verifierDigest: digest,
    });
    expect(await rowOf(gameId, "all", userId)).toEqual([]);
    await database
      .update(gameRuns)
      .set({
        score: 77,
        state: "submitted",
        submittedAt: at("2026-11-03T10:00:00.000Z"),
        verdict: "verified",
      })
      .where(eq(gameRuns.id, id));
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({
      score: 77,
    });
  });

  it("goes with the player's account", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    await settle(userId, gameId, 5, "2026-11-03T10:00:00.000Z");
    await database.delete(authUsers).where(eq(authUsers.id, userId));
    expect(await rowOf(gameId, "all", userId)).toEqual([]);
  });

  it("is what the migration's own backfill makes of verified runs that settled before it", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    await database.execute(
      sql`alter table frostbite.game_runs disable trigger user`,
    );
    try {
      await settle(userId, gameId, 10, "2026-11-03T10:00:00.000Z");
      await settle(userId, gameId, 90, "2026-11-10T10:00:00.000Z");
      await settle(
        userId,
        gameId,
        null,
        "2026-11-11T10:00:00.000Z",
        "rejected",
      );
    } finally {
      await database.execute(
        sql`alter table frostbite.game_runs enable trigger user`,
      );
    }
    expect(await rowOf(gameId, "all", userId)).toEqual([]);
    await runBackfill(gameId);
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({
      score: 90,
    });
    expect(
      (await rowOf(gameId, "week", userId)).map(({ score }) => score).sort(),
    ).toEqual([10, 90]);
  });
});

describe("reading a board", () => {
  it("lists the highest scores first, the earlier ahead on a tie, ranks shared by equal scores, within the limit", async () => {
    const [gameId, ...players] = [
      freshGame(),
      await seedUser(),
      await seedUser(),
      await seedUser(),
      await seedUser(),
    ];
    const [a, b, c, d] = players;
    await settle(a ?? "", gameId, 500, "2026-11-03T10:00:00.000Z");
    await settle(b ?? "", gameId, 800, "2026-11-04T10:00:00.000Z");
    await settle(c ?? "", gameId, 500, "2026-11-02T10:00:00.000Z");
    await settle(d ?? "", gameId, 100, "2026-11-05T10:00:00.000Z");
    const period = { gameId, kind: "all", start: "1970-01-01" } as const;
    const top = await topScores(database, period, 3);
    expect(top.map(({ rank, score, userId }) => [userId, score, rank])).toEqual(
      [
        [b, 800, 1],
        [c, 500, 2],
        [a, 500, 2],
      ],
    );
    expect(await playersOnBoard(database, period)).toBe(4);
    expect(await rankOf(database, period, d ?? "")).toEqual({
      rank: 4,
      score: 100,
    });
    expect(await rankOf(database, period, a ?? "")).toEqual({
      rank: 2,
      score: 500,
    });
    expect(await rankOf(database, period, await seedUser())).toBeNull();
  });

  it("is empty for a game or period nobody has scored in", async () => {
    const period = {
      gameId: freshGame(),
      kind: "week",
      start: "2026-11-02",
    } as const;
    expect(await topScores(database, period, 25)).toEqual([]);
    expect(await playersOnBoard(database, period)).toBe(0);
  });

  it("is read in the board index's own order, so no sort of every score is needed", async () => {
    const plan = JSON.stringify(
      await database.transaction(async (tx) => {
        // On a table this small the planner may sort anyway; forbidding a sort shows whether the index can give the order itself.
        await tx.execute(sql`set local enable_sort = off`);
        return tx.execute(
          sql`explain select user_id from frostbite.game_score_bests where game_id = 'x' and window_kind = 'all' and window_start = '1970-01-01' order by score desc nulls last, achieved_at asc limit 25`,
        );
      }),
    );
    expect(plan).toContain("game_score_bests_board_idx");
    expect(plan).not.toContain("Sort");
  });
});
