import {
  authUsers,
  gameMilestoneUnlocks,
  gameSaves,
} from "@frostbite/database";
import type { GameState } from "@frostbite/shared/games";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  milestone,
  players,
  registerAccountDatabase,
  service,
  uuid,
} from "./support/account-database.ts";

registerAccountDatabase();

describe("the account's saved state in PostgreSQL", () => {
  it("returns an empty state for a player who never synced, and creates the row to lock", async () => {
    expect(
      await service.sync(players.userId, {
        gameId: "tap-tower",
        state: { counters: [], milestones: [], progress: null },
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: { counters: [], milestones: [], progress: null },
    });
    expect(await database.select().from(gameSaves)).toHaveLength(1);
  });

  it("stores a save and milestones, and a second device reads them back", async () => {
    const saved: GameState = {
      counters: [],
      milestones: [milestone("first-five", "2026-10-01T00:00:00.000Z")],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { taps: 5 } },
    };
    await service.sync(players.userId, { gameId: "tap-tower", state: saved });
    expect(
      await service.sync(players.userId, {
        gameId: "tap-tower",
        state: { counters: [], milestones: [], progress: null },
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: saved,
    });
  });

  it("keeps the newer save when an older device syncs later, and a replay changes nothing", async () => {
    const newer: GameState = {
      counters: [],
      milestones: [],
      progress: { savedAt: "2026-10-02T00:00:00.000Z", state: { taps: 9 } },
    };
    const older: GameState = {
      counters: [],
      milestones: [],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: { taps: 1 } },
    };
    await service.sync(players.userId, { gameId: "tap-tower", state: newer });
    const afterOlder = await service.sync(players.userId, {
      gameId: "tap-tower",
      state: older,
    });
    expect(afterOlder).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: newer,
    });
    const [before] = await database.select().from(gameSaves);
    await service.sync(players.userId, { gameId: "tap-tower", state: newer });
    const [after] = await database.select().from(gameSaves);
    expect(after).toEqual(before);
  });

  it("stores a save whose state is JSON null as a save, not as no save", async () => {
    const nullSave: GameState = {
      counters: [],
      milestones: [],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: null },
    };
    await service.sync(players.userId, {
      gameId: "tap-tower",
      state: nullSave,
    });
    expect(
      await service.sync(players.userId, {
        gameId: "tap-tower",
        state: { counters: [], milestones: [], progress: null },
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: nullSave,
    });
  });

  it("keeps the earliest unlock time and never removes a milestone", async () => {
    await service.sync(players.userId, {
      gameId: "tap-tower",
      state: {
        counters: [],
        milestones: [milestone("first-five", "2026-10-05T00:00:00.000Z")],
        progress: null,
      },
    });
    const merged = await service.sync(players.userId, {
      gameId: "tap-tower",
      state: {
        counters: [],
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
        counters: [],
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
      .where(eq(gameMilestoneUnlocks.userId, players.userId));
    expect(rows).toHaveLength(2);
  });

  it("keeps players and games apart", async () => {
    const mine: GameState = {
      counters: [],
      milestones: [milestone("first-five", "2026-10-01T00:00:00.000Z")],
      progress: { savedAt: "2026-10-01T00:00:00.000Z", state: "mine" },
    };
    await service.sync(players.userId, { gameId: "tap-tower", state: mine });
    const empty: GameState = { counters: [], milestones: [], progress: null };
    expect(
      await service.sync(players.otherId, {
        gameId: "tap-tower",
        state: empty,
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: empty,
    });
    expect(
      await service.sync(players.userId, {
        gameId: "other-game",
        state: empty,
      }),
    ).toEqual({
      kind: "synced",
      playerId: expect.stringMatching(uuid),
      state: empty,
    });
  });

  it("is removed with the player", async () => {
    await service.sync(players.userId, {
      gameId: "tap-tower",
      state: {
        counters: [],
        milestones: [milestone("first-five", "2026-10-01T00:00:00.000Z")],
        progress: { savedAt: "2026-10-01T00:00:00.000Z", state: 1 },
      },
    });
    await database.delete(authUsers).where(eq(authUsers.id, players.userId));
    expect(await database.select().from(gameSaves)).toEqual([]);
    expect(await database.select().from(gameMilestoneUnlocks)).toEqual([]);
  });

  it("keeps one player id per player and game, across syncs, and gives each player and game its own", async () => {
    const empty: GameState = { counters: [], milestones: [], progress: null };
    const idOf = async (user: string, game: string) => {
      const outcome = await service.sync(user, { gameId: game, state: empty });
      return outcome.kind === "synced" ? outcome.playerId : "none";
    };
    const first = await idOf(players.userId, "tap-tower");
    expect(first).toMatch(uuid);
    expect(await idOf(players.userId, "tap-tower")).toBe(first);
    expect(await idOf(players.otherId, "tap-tower")).not.toBe(first);
    expect(await idOf(players.userId, "other-game")).not.toBe(first);
    const [row] = await database
      .select({ playerId: gameSaves.playerId })
      .from(gameSaves)
      .where(eq(gameSaves.userId, players.userId));
    expect([first, await idOf(players.userId, "other-game")]).toContain(
      row?.playerId,
    );
  });
});
