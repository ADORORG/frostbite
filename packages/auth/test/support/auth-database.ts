import {
  authSecurityEvents,
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  walletChallenges,
  walletIdentities,
} from "@ador/database";
import type { UuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleWalletAuthRepository } from "../../src/adapters/drizzle-wallet-auth-repository.ts";
import { createWalletAuthService } from "../../src/application/service.ts";
import { strictBip322Verifier } from "../../src/bitcoin/verifier.ts";
import {
  signWalletMessage,
  validChallengeInput,
  walletAuthPolicy,
} from "./fixtures.ts";

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
// The service's clock, which a test moves to expire a challenge or age a session.
export const clock = { now: new Date("2026-09-08T12:00:00.000Z") };

export const service = createWalletAuthService({
  clock: () => clock.now,
  policy: walletAuthPolicy,
  repository: createDrizzleWalletAuthRepository(database),
  verifier: strictBip322Verifier,
});

export async function issue() {
  const challenge = await service.issue(validChallengeInput());
  if (challenge === null) throw new Error("Valid challenge was rejected");
  return challenge;
}

export async function verifyIssued(
  challenge: Awaited<ReturnType<typeof issue>>,
  expected: {
    expectedAction: "link-wallet" | "sign-in" | "step-up";
    expectedUserId?: UuidV7;
  } = { expectedAction: "sign-in" },
) {
  return service.verify({
    ...expected,
    challengeId: challenge.challengeId,
    signature: signWalletMessage(challenge.message),
  });
}

// Migrates once, empties the account tables before each test (a wallet link records a security event that keeps its
// session and user, so the events go first) and closes the pool at the end.
export function registerAuthDatabase(): void {
  beforeAll(async () => {
    await runMigrations(environment);
  });
  beforeEach(async () => {
    await database.delete(authSecurityEvents);
    await database.delete(authSessions);
    await database.delete(walletChallenges);
    await database.delete(walletIdentities);
    await database.delete(authUsers);
    clock.now = new Date("2026-09-08T12:00:00.000Z");
  });
  afterAll(async () => {
    await pool.end();
  });
}
