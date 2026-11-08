import { randomUUID } from "node:crypto";

import { authUsers, gameRuns } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  digest,
  newRun,
  registerDatabase,
  runOf,
  seedUser,
} from "./support/database.ts";

registerDatabase();

const insert = async (over: Record<string, unknown>) => {
  const userId = await seedUser();
  return database.insert(gameRuns).values({ ...newRun(userId), ...over });
};
const refused = (promise: Promise<unknown>, name: string) =>
  expect(promise).rejects.toMatchObject({ cause: { constraint: name } });

describe("what the game_runs table refuses by itself", () => {
  it("accepts a well-formed run, with the edges of a seed", async () => {
    await insert({ seed: 0 });
    await insert({ seed: 4_294_967_295 });
  });

  it("refuses a seed that is not 32 bits", async () => {
    await refused(insert({ seed: -1 }), "game_runs_seed_32_bits");
    await refused(insert({ seed: 4_294_967_296 }), "game_runs_seed_32_bits");
  });

  it("refuses a state that is not one of the three, and an expiry that is not after the issue", async () => {
    await refused(insert({ state: "pending" }), "game_runs_state_known");
    const now = new Date("2026-10-15T12:00:00.000Z");
    await refused(
      insert({ expiresAt: now, issuedAt: now }),
      "game_runs_expiry_after_issue",
    );
  });

  it("refuses a score on a run that is not verified, and a score below nothing", async () => {
    const settled = { state: "submitted", submittedAt: new Date() };
    await refused(
      insert({ ...settled, score: 10, verdict: "rejected" }),
      "game_runs_score_coherent",
    );
    await refused(
      insert({ ...settled, score: 10, state: "issued", submittedAt: null }),
      "game_runs_score_coherent",
    );
    await refused(
      insert({ ...settled, score: -1, verdict: "verified" }),
      "game_runs_score_coherent",
    );
    await insert({ ...settled, score: 0, verdict: "verified" });
  });

  it("refuses a verdict that is not verified or rejected, and a digest that is not a SHA-256", async () => {
    await refused(
      insert({ state: "submitted", submittedAt: new Date(), verdict: "maybe" }),
      "game_runs_verdict_known",
    );
    await refused(insert({ verifierDigest: "nope" }), "game_runs_digest_shape");
    await refused(
      insert({ recordDigest: "A".repeat(64) }),
      "game_runs_digest_shape",
    );
  });

  it("refuses a submitted run without a verdict and a time, and a verdict or time on a run that is not submitted", async () => {
    await refused(
      insert({ state: "submitted" }),
      "game_runs_submitted_coherent",
    );
    await refused(
      insert({ state: "submitted", verdict: "verified" }),
      "game_runs_submitted_coherent",
    );
    await refused(
      insert({ state: "submitted", submittedAt: new Date() }),
      "game_runs_submitted_coherent",
    );
    await refused(
      insert({ verdict: "verified" }),
      "game_runs_submitted_coherent",
    );
    await refused(
      insert({ submittedAt: new Date() }),
      "game_runs_submitted_coherent",
    );
    await insert({
      state: "submitted",
      submittedAt: new Date(),
      verdict: "rejected",
    });
  });

  it("refuses a kept record longer than the ceiling", async () => {
    await insert({ recordText: "x".repeat(65_536) });
    await refused(
      insert({ recordText: "x".repeat(65_537) }),
      "game_runs_record_bounded",
    );
  });

  it("refuses a run for a player that does not exist, and removes a player's runs with the player", async () => {
    await refused(
      database.insert(gameRuns).values(newRun(randomUUID())),
      "game_runs_user_id_auth_users_id_fkey",
    );
    const userId = await seedUser();
    const run = newRun(userId);
    await database.insert(gameRuns).values(run);
    await database.delete(authUsers).where(eq(authUsers.id, userId));
    expect(await runOf(run.id)).toBeUndefined();
    expect(digest).toHaveLength(64);
  });
});
