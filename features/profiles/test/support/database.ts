import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameMilestoneClaims,
  gameRuns,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { afterAll, beforeAll } from "vitest";

// The profile feature against real PostgreSQL: one pool, and rows for the records a profile page reads.
export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);

export function registerDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  afterAll(async () => pool.end());
}

export async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}

const at = new Date("2026-11-08T12:00:00.000Z");
const digest = "a".repeat(64);

// A run the platform replayed: its verdict and score (none for a run that scored nothing).
export async function settledRun(
  userId: string,
  gameId: string,
  over: {
    readonly day: number;
    readonly score: number | null;
    readonly verdict?: "rejected" | "verified";
  },
) {
  await database.insert(gameRuns).values({
    expiresAt: new Date(at.getTime() + 86_400_000),
    gameId,
    id: randomUUID(),
    issuedAt: at,
    score: over.score,
    seed: 1,
    state: "submitted",
    submittedAt: new Date(`2026-11-0${String(over.day)}T12:00:00.000Z`),
    userId,
    verdict: over.verdict ?? "verified",
    verifierDigest: digest,
  });
}

// A claim in the state given; only a complete one is a mint.
export async function claimOf(
  userId: string,
  gameId: string,
  milestoneId: string,
  state: "complete" | "signed",
): Promise<string> {
  const id = randomUUID();
  const complete = state === "complete";
  await database.insert(gameMilestoneClaims).values({
    broadcastAt: complete ? at : null,
    chain: "simnet:one",
    contractFamily: "simulated",
    contractId: "rewards-1",
    expectedClaims: 1,
    expiresAt: new Date(at.getTime() + 86_400_000),
    gameId,
    id,
    milestoneId,
    platformFeeSats: 0n,
    signedPayload: "signed",
    state,
    summary: {},
    transactionId: complete ? randomUUID().replaceAll("-", "") : null,
    unsignedFamily: "simulated",
    unsignedFormat: "sim-json/1",
    unsignedPayload: "unsigned",
    updatedAt: at,
    userId,
    walletAddress: "sim:simnet:one:a1b2c3",
  });
  return id;
}
