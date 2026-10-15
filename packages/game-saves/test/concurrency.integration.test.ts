import { gameSaves } from "@ador/database";
import type { GameState } from "@ador/shared/games";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  milestone,
  players,
  registerAccountDatabase,
  repository,
  service,
} from "./support/account-database.ts";

registerAccountDatabase();

describe("two devices syncing at once, in PostgreSQL", () => {
  it("loses no milestone when two devices sync at the same moment", async () => {
    const attempts = ["first-five", "ten-taps"].map((id) =>
      service.sync(players.userId, {
        gameId: "tap-tower",
        state: {
          counters: [],
          milestones: [milestone(id, "2026-10-01T00:00:00.000Z")],
          progress: null,
        },
      }),
    );
    await Promise.all(attempts);
    const final = await service.sync(players.userId, {
      gameId: "tap-tower",
      state: { counters: [], milestones: [], progress: null },
    });
    expect(
      final.kind === "synced" && final.state.milestones.map(({ id }) => id),
    ).toEqual(["first-five", "ten-taps"]);
  });

  it("loses no save when two devices sync at the same moment: the newer one remains", async () => {
    const save = (taps: number, day: string): GameState => ({
      counters: [],
      milestones: [],
      progress: { savedAt: `2026-10-${day}T00:00:00.000Z`, state: { taps } },
    });
    await Promise.all([
      service.sync(players.userId, {
        gameId: "tap-tower",
        state: save(1, "01"),
      }),
      service.sync(players.userId, {
        gameId: "tap-tower",
        state: save(2, "02"),
      }),
    ]);
    const [row] = await database.select().from(gameSaves);
    expect(row?.progress).toEqual({ taps: 2 });
  });

  it("waits for whoever holds the player's rows before it decides", async () => {
    const empty: GameState = { counters: [], milestones: [], progress: null };
    await service.sync(players.userId, { gameId: "tap-tower", state: empty });
    // Another transaction holds the rows, as a sync in flight on another device would.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const held = database.transaction(async (transaction) => {
      await transaction
        .select()
        .from(gameSaves)
        .where(eq(gameSaves.userId, players.userId))
        .for("update");
      await gate;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    let decided = false;
    const change = repository.change(players.userId, "tap-tower", (stored) => {
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
});
