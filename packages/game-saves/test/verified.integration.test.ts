import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameMilestoneUnlocks,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDrizzleGameSyncRepository } from "../src/drizzle-repository.ts";
import { createGameSyncService } from "../src/service.ts";
import { recordVerifiedMilestones } from "../src/verified-milestones.ts";
import { rules } from "./support/rules.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const service = createGameSyncService({
  clock: () => new Date("2026-10-12T12:00:00.000Z"),
  games: new Map([["any-game", rules(["first-win", "first-glacier"])]]),
  maxProgressBytes: 65_536,
  repository: createDrizzleGameSyncRepository(database),
});
const at = new Date("2026-10-10T00:00:00.000Z");
const reported = (id: string, unlockedAt: string) => ({
  count: 1,
  id,
  unlockedAt,
  verification: "self-reported" as const,
});

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}
const rowsOf = async (userId: string) =>
  (
    await database
      .select()
      .from(gameMilestoneUnlocks)
      .where(and(eq(gameMilestoneUnlocks.userId, userId)))
  ).sort((a, b) => a.milestoneId.localeCompare(b.milestoneId));
const verify = (userId: string, earned: string[]) =>
  database.transaction((transaction) =>
    recordVerifiedMilestones(transaction, {
      at,
      earned,
      gameId: "any-game",
      userId,
    }),
  );

beforeAll(async () => runMigrations(environment));
afterAll(async () => pool.end());

describe("milestones the platform verified, in PostgreSQL", () => {
  it("unlocks a milestone not held, at the verdict's time, as replay-verified", async () => {
    const userId = await seedUser();
    await verify(userId, ["first-win"]);
    expect(await rowsOf(userId)).toMatchObject([
      {
        count: 1,
        milestoneId: "first-win",
        unlockedAt: at,
        verification: "replay-verified",
      },
    ]);
  });

  it("upgrades a self-reported milestone, keeping its unlock time and count, and is the same when applied again", async () => {
    const userId = await seedUser();
    await service.sync(userId, {
      gameId: "any-game",
      state: {
        counters: [],
        milestones: [reported("first-win", "2026-10-01T00:00:00.000Z")],
        progress: null,
      },
    });
    await verify(userId, ["first-win", "first-glacier"]);
    await verify(userId, ["first-win", "first-glacier"]);
    expect(await rowsOf(userId)).toMatchObject([
      {
        milestoneId: "first-glacier",
        unlockedAt: at,
        verification: "replay-verified",
      },
      {
        count: 1,
        milestoneId: "first-win",
        unlockedAt: new Date("2026-10-01T00:00:00.000Z"),
        verification: "replay-verified",
      },
    ]);
  });

  it("is not lowered by a later report of the same milestone, and the account answers with the verified level", async () => {
    const userId = await seedUser();
    await verify(userId, ["first-win"]);
    const outcome = await service.sync(userId, {
      gameId: "any-game",
      state: {
        counters: [],
        milestones: [reported("first-win", "2026-10-09T00:00:00.000Z")],
        progress: null,
      },
    });
    expect(outcome).toMatchObject({
      state: {
        milestones: [{ id: "first-win", verification: "replay-verified" }],
      },
    });
    expect((await rowsOf(userId))[0]).toMatchObject({
      unlockedAt: at,
      verification: "replay-verified",
    });
  });

  it("is not granted by a browser that names the level, and does nothing for a verdict that earned nothing", async () => {
    const userId = await seedUser();
    await service.sync(userId, {
      gameId: "any-game",
      state: {
        counters: [],
        milestones: [
          {
            ...reported("first-win", "2026-10-01T00:00:00.000Z"),
            verification: "replay-verified",
          },
        ],
        progress: null,
      },
    });
    await verify(userId, []);
    expect(await rowsOf(userId)).toMatchObject([
      { milestoneId: "first-win", verification: "self-reported" },
    ]);
  });

  it("rolls back with the transaction it is part of", async () => {
    const userId = await seedUser();
    await expect(
      database.transaction(async (transaction) => {
        await recordVerifiedMilestones(transaction, {
          at,
          earned: ["first-win"],
          gameId: "any-game",
          userId,
        });
        throw new Error("the verdict could not be stored");
      }),
    ).rejects.toThrow("the verdict could not be stored");
    expect(await rowsOf(userId)).toEqual([]);
  });

  it("stores a level the decision changes, because the repository keeps what it is told", async () => {
    const userId = await seedUser();
    const repository = createDrizzleGameSyncRepository(database);
    await repository.change(userId, "any-game", () => ({
      counters: [],
      milestones: [reported("first-win", "2026-10-01T00:00:00.000Z")],
      progress: null,
    }));
    await repository.change(userId, "any-game", (stored) => ({
      ...stored,
      milestones: stored.milestones.map((record) => ({
        ...record,
        verification: "replay-verified" as const,
      })),
    }));
    expect(await rowsOf(userId)).toMatchObject([
      { milestoneId: "first-win", verification: "replay-verified" },
    ]);
  });
});
