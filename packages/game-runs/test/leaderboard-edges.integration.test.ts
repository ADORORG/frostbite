import { randomUUID } from "node:crypto";

import { gameRuns, playerProfiles } from "@frostbite/database";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { topScores } from "../src/leaderboard.ts";
import { at, freshGame, rowOf, runBackfill, settle } from "./support/board.ts";
import {
  database,
  digest,
  registerDatabase,
  seedUser,
} from "./support/database.ts";

registerDatabase();

const profile = (userId: string, name: string, visible: boolean) =>
  database.insert(playerProfiles).values({
    avatar: "snowman",
    createdAt: at("2026-01-01T00:00:00.000Z"),
    name,
    nameChangedAt: at("2026-01-01T00:00:00.000Z"),
    nameKey: name.toLowerCase(),
    updatedAt: at("2026-01-01T00:00:00.000Z"),
    userId,
    visible,
  });

describe("who a board names", () => {
  it("names a player only while their public profile is on, and never a player without one", async () => {
    const gameId = freshGame();
    const [shown, hidden, none] = [
      await seedUser(),
      await seedUser(),
      await seedUser(),
    ];
    await profile(shown, "Shown", true);
    await profile(hidden, "Hidden", false);
    await settle(shown, gameId, 300, "2026-11-03T10:00:00.000Z");
    await settle(hidden, gameId, 200, "2026-11-03T10:00:00.000Z");
    await settle(none, gameId, 100, "2026-11-03T10:00:00.000Z");
    const rows = await topScores(
      database,
      { gameId, kind: "all", start: "1970-01-01" },
      25,
    );
    expect(rows.map(({ profile: p, userId }) => [userId, p])).toEqual([
      [shown, { avatar: "snowman", name: "Shown" }],
      [hidden, null],
      [none, null],
    ]);
  });
});

describe("the best scores kept when a stored run changes", () => {
  it("follows a better score given to a run that was already verified", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    const id = randomUUID();
    await database.insert(gameRuns).values({
      expiresAt: at("2030-01-01T00:00:00.000Z"),
      gameId,
      id,
      issuedAt: at("2026-01-01T00:00:00.000Z"),
      score: 50,
      seed: 1,
      state: "submitted",
      submittedAt: at("2026-11-03T10:00:00.000Z"),
      userId,
      verdict: "verified",
      verifierDigest: digest,
    });
    await database
      .update(gameRuns)
      .set({ score: 90 })
      .where(eq(gameRuns.id, id));
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({
      score: 90,
    });
  });
});

describe("the backfill of earlier runs", () => {
  it("keeps the earlier of two runs that reached the same best score", async () => {
    const [userId, gameId] = [await seedUser(), freshGame()];
    await database.execute(
      sql`alter table frostbite.game_runs disable trigger user`,
    );
    try {
      await settle(userId, gameId, 40, "2026-11-05T10:00:00.000Z");
      await settle(userId, gameId, 40, "2026-11-03T10:00:00.000Z");
    } finally {
      await database.execute(
        sql`alter table frostbite.game_runs enable trigger user`,
      );
    }
    await runBackfill(gameId);
    expect((await rowOf(gameId, "all", userId))[0]).toMatchObject({
      achievedAt: at("2026-11-03T10:00:00.000Z"),
      score: 40,
    });
  });
});
