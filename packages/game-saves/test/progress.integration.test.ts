import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameMilestoneUnlocks,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import type { GameState } from "@frostbite/shared/games";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleGameSyncRepository } from "../src/drizzle-repository.ts";
import { createGameSyncService } from "../src/service.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleGameSyncRepository(database);
const now = new Date("2026-10-13T12:00:00.000Z");
let userId = "";

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(authUsers);
  userId = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${userId}@example.test`, id: userId, name: "Player" });
});
afterAll(async () => {
  await database.delete(authUsers);
  await pool.end();
});

describe("counts and totals in PostgreSQL", () => {
  it("the larger side wins, limits hold, and reaching a target earns the milestone", async () => {
    const counting = createGameSyncService({
      clock: () => now,
      games: new Map([
        [
          "counting-game",
          new Map([
            ["ten-wins", { claimPolicy: "once" as const, target: 10 }],
            ["a-win", { claimPolicy: "repeatable" as const, maxCount: 3 }],
          ]),
        ],
      ]),
      maxProgressBytes: 65_536,
      repository,
    });
    const send = async (state: GameState) => {
      const outcome = await counting.sync(userId, {
        gameId: "counting-game",
        state,
      });
      return outcome.kind === "synced" ? outcome.state : outcome;
    };
    const earned = (count: number) => ({
      count,
      id: "a-win",
      unlockedAt: "2026-10-01T00:00:00.000Z",
      verification: "self-reported" as const,
    });
    await send({
      counters: [{ current: 4, id: "ten-wins" }],
      milestones: [earned(2)],
      progress: null,
    });
    // A smaller report from another device changes nothing; a count past the limit is cut to it.
    expect(
      await send({
        counters: [{ current: 1, id: "ten-wins" }],
        milestones: [earned(1)],
        progress: null,
      }),
    ).toMatchObject({
      counters: [{ current: 4, id: "ten-wins" }],
      milestones: [{ count: 2, id: "a-win" }],
    });
    expect(
      await send({ counters: [], milestones: [earned(50)], progress: null }),
    ).toMatchObject({
      milestones: [{ count: 3, id: "a-win" }],
    });
    // Reaching the target earns the milestone, with the account's own time.
    const reached = await send({
      counters: [{ current: 99, id: "ten-wins" }],
      milestones: [],
      progress: null,
    });
    expect(reached).toMatchObject({
      counters: [{ current: 10, id: "ten-wins" }],
      milestones: [
        { count: 3, id: "a-win" },
        { count: 1, id: "ten-wins", unlockedAt: now.toISOString() },
      ],
    });
    // What is stored is what is answered, and replaying it changes nothing.
    expect(
      await send({ counters: [], milestones: [], progress: null }),
    ).toEqual(reached);
    const rows = await database
      .select({
        count: gameMilestoneUnlocks.count,
        id: gameMilestoneUnlocks.milestoneId,
      })
      .from(gameMilestoneUnlocks)
      .where(eq(gameMilestoneUnlocks.userId, userId));
    expect(rows.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { count: 3, id: "a-win" },
      { count: 1, id: "ten-wins" },
    ]);
  });
});
