import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameMilestoneUnlocks,
  gameSaves,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import type { GameState } from "@ador/shared/games";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleGameSyncRepository } from "../src/drizzle-repository.ts";
import { createGameSyncService } from "../src/service.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleGameSyncRepository(database);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const now = new Date("2026-10-12T12:00:00.000Z");
const service = createGameSyncService({
  clock: () => now,
  games: new Map([
    ["tap-tower", new Set(["first-five", "ten-taps"])],
    ["other-game", new Set(["first-five"])],
  ]),
  maxProgressBytes: 65_536,
  repository,
});
const milestone = (id: string, unlockedAt: string) => ({
  id,
  unlockedAt,
  verification: "self-reported" as const,
});
let userId = "";
let otherId = "";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(authUsers);
  userId = await seedUser();
  otherId = await seedUser();
});
afterAll(async () => {
  await database.delete(authUsers);
  await pool.end();
});

describe("the account's saved state in PostgreSQL", () => {
  it("returns an empty state for a player who never synced, and creates the row to lock", async () => {
    expect(
      await service.sync(userId, {
        gameId: "tap-tower",
        state: { milestones: [], progress: null },
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: { milestones: [], progress: null },
    });
    expect(await database.select().from(gameSaves)).toHaveLength(1);
  });

  it("stores a save and milestones, and a second device reads them back", async () => {
    const saved: GameState = {
      milestones: [milestone("first-five", "2026-10-01T00:00:00.000Z")],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { taps: 5 } },
    };
    await service.sync(userId, { gameId: "tap-tower", state: saved });
    expect(
      await service.sync(userId, {
        gameId: "tap-tower",
        state: { milestones: [], progress: null },
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: saved,
    });
  });

  it("keeps the newer save when an older device syncs later, and a replay changes nothing", async () => {
    const newer: GameState = {
      milestones: [],
      progress: { savedAt: "2026-10-02T00:00:00.000Z", state: { taps: 9 } },
    };
    const older: GameState = {
      milestones: [],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { taps: 1 } },
    };
    await service.sync(userId, { gameId: "tap-tower", state: newer });
    const afterOlder = await service.sync(userId, {
      gameId: "tap-tower",
      state: older,
    });
    expect(afterOlder).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: newer,
    });
    const [before] = await database.select().from(gameSaves);
    await service.sync(userId, { gameId: "tap-tower", state: newer });
    const [after] = await database.select().from(gameSaves);
    expect(after).toEqual(before);
  });

  it("stores a save whose state is JSON null as a save, not as no save", async () => {
    const nullSave: GameState = {
      milestones: [],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: null },
    };
    await service.sync(userId, { gameId: "tap-tower", state: nullSave });
    expect(
      await service.sync(userId, {
        gameId: "tap-tower",
        state: { milestones: [], progress: null },
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: nullSave,
    });
  });

  it("keeps the earliest unlock time and never removes a milestone", async () => {
    await service.sync(userId, {
      gameId: "tap-tower",
      state: {
        milestones: [milestone("first-five", "2026-10-05T00:00:00.000Z")],
        progress: null,
      },
    });
    const merged = await service.sync(userId, {
      gameId: "tap-tower",
      state: {
        milestones: [
          milestone("first-five", "2026-10-03T00:00:00.000Z"),
          milestone("ten-taps", "2026-10-04T00:00:00.000Z"),
        ],
        progress: null,
      },
    });
    expect(merged).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: {
        milestones: [
          milestone("first-five", "2026-10-03T00:00:00.000Z"),
          milestone("ten-taps", "2026-10-04T00:00:00.000Z"),
        ],
        progress: null,
      },
    });
    const rows = await database
      .select()
      .from(gameMilestoneUnlocks)
      .where(eq(gameMilestoneUnlocks.userId, userId));
    expect(rows).toHaveLength(2);
  });

  it("keeps players and games apart", async () => {
    const mine: GameState = {
      milestones: [milestone("first-five", "2026-10-01T00:00:00.000Z")],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: "mine" },
    };
    await service.sync(userId, { gameId: "tap-tower", state: mine });
    const empty: GameState = { milestones: [], progress: null };
    expect(
      await service.sync(otherId, { gameId: "tap-tower", state: empty }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: empty,
    });
    expect(
      await service.sync(userId, { gameId: "other-game", state: empty }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: empty,
    });
  });

  it("loses no milestone when two devices sync at the same moment", async () => {
    const attempts = ["first-five", "ten-taps"].map((id) =>
      service.sync(userId, {
        gameId: "tap-tower",
        state: {
          milestones: [milestone(id, "2026-10-01T00:00:00.000Z")],
          progress: null,
        },
      }),
    );
    await Promise.all(attempts);
    const final = await service.sync(userId, {
      gameId: "tap-tower",
      state: { milestones: [], progress: null },
    });
    expect(
      final.kind === "synced" && final.state.milestones.map(({ id }) => id),
    ).toEqual(["first-five", "ten-taps"]);
  });

  it("loses no save when two devices sync at the same moment: the newer one remains", async () => {
    const save = (taps: number, day: string): GameState => ({
      milestones: [],
      progress: { savedAt: `2026-10-${day}T00:00:00.000Z`, state: { taps } },
    });
    await Promise.all([
      service.sync(userId, { gameId: "tap-tower", state: save(1, "01") }),
      service.sync(userId, { gameId: "tap-tower", state: save(2, "02") }),
    ]);
    const [row] = await database.select().from(gameSaves);
    expect(row?.progress).toEqual({ taps: 2 });
  });

  it("waits for whoever holds the player's rows before it decides", async () => {
    const empty: GameState = { milestones: [], progress: null };
    await service.sync(userId, { gameId: "tap-tower", state: empty });
    // Another transaction holds the rows, as a sync in flight on another device would.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const held = database.transaction(async (transaction) => {
      await transaction
        .select()
        .from(gameSaves)
        .where(eq(gameSaves.userId, userId))
        .for("update");
      await gate;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    let decided = false;
    const change = repository.change(userId, "tap-tower", (stored) => {
      decided = true;
      return stored;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(decided).toBe(false);
    release();
    await held;
    await change;
    expect(decided).toBe(true);
  });

  it("is removed with the player", async () => {
    await service.sync(userId, {
      gameId: "tap-tower",
      state: {
        milestones: [milestone("first-five", "2026-10-01T00:00:00.000Z")],
        progress: { savedAt: "2026-10-01T00:00:00.000Z", state: 1 },
      },
    });
    await database.delete(authUsers).where(eq(authUsers.id, userId));
    expect(await database.select().from(gameSaves)).toEqual([]);
    expect(await database.select().from(gameMilestoneUnlocks)).toEqual([]);
  });

  it("keeps one player id per player and game, across syncs, and gives each player and game its own", async () => {
    const empty: GameState = { milestones: [], progress: null };
    const idOf = async (user: string, game: string) => {
      const outcome = await service.sync(user, { gameId: game, state: empty });
      return outcome.kind === "synced" ? outcome.playerId : "none";
    };
    const first = await idOf(userId, "tap-tower");
    expect(first).toMatch(uuid);
    expect(await idOf(userId, "tap-tower")).toBe(first);
    expect(await idOf(otherId, "tap-tower")).not.toBe(first);
    expect(await idOf(userId, "other-game")).not.toBe(first);
    const [row] = await database
      .select({ playerId: gameSaves.playerId })
      .from(gameSaves)
      .where(eq(gameSaves.userId, userId))
      .limit(1);
    expect([first, await idOf(userId, "other-game")]).toContain(row?.playerId);
  });
});
