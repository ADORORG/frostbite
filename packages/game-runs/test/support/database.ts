import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameRuns,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleGameRunRepository } from "../../src/drizzle-repository.ts";
import type { NewRun, RunVerdict } from "../../src/repository.ts";

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const clock = { now: new Date("2026-10-15T12:00:00.000Z") };
export const digest = "a".repeat(64);
export const hour = 3_600_000;

export async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}

export const newRun = (
  userId: string,
  gameId = "any-game",
  over: Partial<NewRun> = {},
): NewRun => ({
  expiresAt: new Date(clock.now.getTime() + 24 * hour),
  gameId,
  id: randomUUID(),
  issuedAt: clock.now,
  seed: 4_000_000_000,
  userId,
  verifierDigest: digest,
  ...over,
});

export const verified = (
  earned: string[] = ["first-win"],
  score: number | null = null,
): RunVerdict => ({
  earned,
  score,
  reason: null,
  recordDigest: "b".repeat(64),
  recordText: '{"claims":[]}',
  status: "verified",
});

export const runOf = async (id: string) => {
  const [row] = await database
    .select()
    .from(gameRuns)
    .where(eq(gameRuns.id, id));
  return row;
};

export const hooks: {
  calls: { earned: readonly string[]; runId: string }[];
  fail: boolean;
} = {
  calls: [],
  fail: false,
};

export const repository = createDrizzleGameRunRepository(database, {
  clock: () => clock.now,
  onVerified: async (_transaction, run, earned) => {
    hooks.calls.push({ earned, runId: run.id });
    if (hooks.fail) throw new Error("the milestone write failed");
  },
});

// Migrates once, resets the clock and the hook before each test, and closes the pool. Players are made per test, and a
// player's runs go with the player.
export function registerDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  beforeEach(() => {
    clock.now = new Date("2026-10-15T12:00:00.000Z");
    hooks.calls = [];
    hooks.fail = false;
  });
  afterAll(async () => pool.end());
}
