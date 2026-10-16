import { randomUUID } from "node:crypto";

import { authUsers, gameMilestoneUnlocks } from "@ador/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hasEarnedMilestone } from "../src/earned.ts";
import { database, environment, pool } from "./support/account-database.ts";
import { runMigrations } from "@ador/database";

beforeAll(async () => runMigrations(environment));
afterAll(async () => pool.end());

async function player(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}
const earnedBy = (userId: string, verification: string) =>
  database.insert(gameMilestoneUnlocks).values({
    count: 1,
    gameId: "arcade",
    milestoneId: "first-win",
    unlockedAt: new Date("2026-10-16T12:00:00.000Z"),
    userId,
    verification,
  });

describe("whether a milestone is on the account", () => {
  it("is true at either level, and for exactly the player, game and milestone", async () => {
    const reported = await player();
    const verified = await player();
    const nobody = await player();
    await earnedBy(reported, "self-reported");
    await earnedBy(verified, "replay-verified");
    const asks = (
      userId: string,
      gameId = "arcade",
      milestoneId = "first-win",
    ) => hasEarnedMilestone(database, { gameId, milestoneId, userId });
    expect(await asks(reported)).toBe(true);
    expect(await asks(verified)).toBe(true);
    expect(await asks(nobody)).toBe(false);
    expect(await asks(reported, "another-game")).toBe(false);
    expect(await asks(reported, "arcade", "first-glacier")).toBe(false);
  });
});
