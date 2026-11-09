import { gamePlayDays } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { playsInWindow, recordPlay } from "../src/hot.ts";
import { at, freshGame } from "./support/board.ts";
import { database, registerDatabase } from "./support/database.ts";

registerDatabase();

const now = at("2026-11-09T12:00:00.000Z");
const playsOf = async (gameId: string) =>
  (await playsInWindow(database, now)).find((c) => c.gameId === gameId)?.plays;

describe("counting the runs started in a game", () => {
  it("adds each start to the day it happened on, however many arrive at once", async () => {
    const gameId = freshGame();
    await Promise.all(
      Array.from({ length: 8 }, () => recordPlay(database, gameId, now)),
    );
    const rows = await database
      .select()
      .from(gamePlayDays)
      .where(eq(gamePlayDays.gameId, gameId));
    expect(rows).toEqual([{ day: "2026-11-09", gameId, plays: 8 }]);
  });

  it("counts a day by UTC, not by the machine's clock", async () => {
    const gameId = freshGame();
    await recordPlay(database, gameId, at("2026-11-09T23:59:59.999Z"));
    await recordPlay(database, gameId, at("2026-11-10T00:00:00.000Z"));
    const days = (
      await database
        .select()
        .from(gamePlayDays)
        .where(eq(gamePlayDays.gameId, gameId))
    )
      .map((r) => r.day)
      .sort();
    expect(days).toEqual(["2026-11-09", "2026-11-10"]);
  });

  it("adds up the days in the window, today being the last, and leaves out the day before it", async () => {
    const gameId = freshGame();
    // The policy's window is seven days: 2026-11-03 .. 2026-11-09.
    await recordPlay(database, gameId, at("2026-11-02T12:00:00.000Z"));
    await recordPlay(database, gameId, at("2026-11-03T00:00:00.000Z"));
    await recordPlay(database, gameId, at("2026-11-09T12:00:00.000Z"));
    await recordPlay(database, gameId, at("2026-11-09T13:00:00.000Z"));
    expect(await playsOf(gameId)).toBe(3);
  });

  it("has nothing for a game that was never started", async () => {
    expect(await playsOf(freshGame())).toBeUndefined();
  });
});
