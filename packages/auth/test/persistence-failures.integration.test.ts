import {
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  walletChallenges,
  walletIdentities,
} from "@frostbite/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleSessionRepository } from "../src/adapters/drizzle-session-repository.ts";
import { createDrizzleWalletAuthRepository } from "../src/adapters/drizzle-wallet-auth-repository.ts";
import { createWalletAuthService } from "../src/application/service.ts";
import { createSessionService } from "../src/application/session-service.ts";
import { strictBip322Verifier } from "../src/bitcoin/verifier.ts";
import {
  signWalletMessage,
  validChallengeInput,
  walletAuthPolicy,
} from "./support/fixtures.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleWalletAuthRepository(database);
let now = new Date("2026-09-08T12:00:00.000Z");
const auth = createWalletAuthService({
  clock: () => now,
  policy: walletAuthPolicy,
  repository,
  verifier: strictBip322Verifier,
});
const sessions = createSessionService({
  clock: () => now,
  idleLifetimeMs: walletAuthPolicy.sessionIdleLifetimeMs,
  repository: createDrizzleSessionRepository(database),
});

beforeAll(async () => runMigrations(environment));

beforeEach(async () => {
  await database.delete(authSessions);
  await database.delete(walletChallenges);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
  now = new Date("2026-09-08T12:00:00.000Z");
});

afterAll(async () => pool.end());

async function authenticate() {
  const challenge = await auth.issue(validChallengeInput());
  if (challenge === null) throw new Error("Expected challenge");
  const result = await auth.verify({
    expectedAction: "sign-in",
    challengeId: challenge.challengeId,
    signature: signWalletMessage(challenge.message),
  });
  if (!result.ok) throw new Error("Expected authentication success");
  return result;
}

describe("authentication persistence failures", () => {
  it("rolls back identity, user, and consumption when session persistence fails", async () => {
    const issued = await auth.issue(validChallengeInput());
    if (issued === null) throw new Error("Expected challenge");
    const stored = await repository.findChallenge(issued.challengeId);
    if (stored === null) throw new Error("Expected stored challenge");

    await expect(
      repository.consumeChallenge(
        stored,
        {
          absoluteExpiresAt: new Date(now.getTime() + 2_000),
          authenticatedAt: now,
          idleExpiresAt: new Date(now.getTime() + 1_000),
          tokenHash: "invalid",
        },
        now,
        walletAuthPolicy.maximumVerificationAttempts,
      ),
    ).rejects.toMatchObject({ cause: { code: "23514" } });

    expect(await database.select().from(authUsers)).toHaveLength(0);
    expect(await database.select().from(walletIdentities)).toHaveLength(0);
    expect(await database.select().from(authSessions)).toHaveLength(0);
    const [challenge] = await database.select().from(walletChallenges);
    expect(challenge?.consumedAt).toBeNull();
  });

  it("rejects sessions at either idle or absolute expiry", async () => {
    const idleExpired = await authenticate();
    now = new Date(now.getTime() + walletAuthPolicy.sessionIdleLifetimeMs);
    await expect(sessions.find(idleExpired.sessionToken)).resolves.toBeNull();
    await database.delete(authSessions);

    const absoluteExpired = await authenticate();
    const [stored] = await database.select().from(authSessions);
    if (stored === undefined) throw new Error("Expected stored session");
    now = stored.absoluteExpiresAt;
    await expect(
      sessions.find(absoluteExpired.sessionToken),
    ).resolves.toBeNull();
  });
});
