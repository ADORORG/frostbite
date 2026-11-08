import { gameRuns } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import { bestsOf } from "../src/bests.ts";
import {
  database,
  digest,
  newRun,
  registerDatabase,
  seedUser,
} from "./support/database.ts";

registerDatabase();

const at = (day: number) => new Date(`2026-11-0${String(day)}T12:00:00.000Z`);
// A settled run of a game with a verdict and a score (or none).
async function settle(
  userId: string,
  gameId: string,
  over: {
    readonly day?: number;
    readonly score: number | null;
    readonly verdict?: "rejected" | "verified";
  },
) {
  const run = newRun(userId, gameId);
  await database.insert(gameRuns).values({
    ...run,
    score: over.score,
    state: "submitted",
    submittedAt: at(over.day ?? 1),
    verdict: over.verdict ?? "verified",
    verifierDigest: digest,
  });
}

describe("a player's best verified score in each game", () => {
  it("is the highest verified score of each game, with when it was reached", async () => {
    const userId = await seedUser();
    await settle(userId, "runner", { day: 1, score: 100 });
    await settle(userId, "runner", { day: 2, score: 900 });
    await settle(userId, "runner", { day: 3, score: 400 });
    await settle(userId, "stacker", { day: 4, score: 12 });
    expect(await bestsOf(database, userId)).toEqual([
      { achievedAt: at(2), gameId: "runner", score: 900 },
      { achievedAt: at(4), gameId: "stacker", score: 12 },
    ]);
  });

  it("names the earlier run when a score was reached twice", async () => {
    const userId = await seedUser();
    await settle(userId, "runner", { day: 5, score: 50 });
    await settle(userId, "runner", { day: 2, score: 50 });
    expect(await bestsOf(database, userId)).toEqual([
      { achievedAt: at(2), gameId: "runner", score: 50 },
    ]);
  });

  it("counts a score of zero, and ignores runs with no score and runs that were not verified", async () => {
    const userId = await seedUser();
    await settle(userId, "zero", { score: 0 });
    await settle(userId, "unscored", { score: null });
    await settle(userId, "rejected", { score: null, verdict: "rejected" });
    expect(await bestsOf(database, userId)).toEqual([
      { achievedAt: at(1), gameId: "zero", score: 0 },
    ]);
  });

  it("ignores runs that are still open, and other players' runs", async () => {
    const [userId, other] = [await seedUser(), await seedUser()];
    await database.insert(gameRuns).values(newRun(userId, "open"));
    await settle(other, "runner", { score: 5_000 });
    expect(await bestsOf(database, userId)).toEqual([]);
  });
});
