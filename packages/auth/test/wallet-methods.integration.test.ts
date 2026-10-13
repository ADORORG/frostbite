import { randomUUID } from "node:crypto";

import {
  authSecurityEvents,
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  releasedWallets,
  runMigrations,
  walletChallenges,
  walletIdentities,
} from "@ador/database";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleWalletAuthRepository } from "../src/adapters/drizzle-wallet-auth-repository.ts";
import { createWalletAuthService } from "../src/application/service.ts";
import { strictBip322Verifier } from "../src/bitcoin/verifier.ts";
import { sha256 } from "../src/domain/crypto.ts";
import { createDrizzleWalletMethodsRepository } from "../src/wallets/drizzle-repository.ts";
import { createWalletMethodsService } from "../src/wallets/service.ts";
import {
  signWalletMessage,
  validChallengeInput,
  walletAddress,
  walletAuthPolicy,
} from "./support/fixtures.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
let now = new Date("2026-10-13T12:00:00.000Z");
const holdMs = 86_400_000;
const auth = createWalletAuthService({
  clock: () => now,
  policy: walletAuthPolicy,
  repository: createDrizzleWalletAuthRepository(database),
  verifier: strictBip322Verifier,
});
const methods = createWalletMethodsService({
  clock: () => now,
  policy: {
    recentAuthenticationWindowMs: 600_000,
    releaseHoldMs: holdMs,
    sessionAbsoluteLifetimeMs: 86_400_000,
    sessionIdleLifetimeMs: 3_600_000,
  },
  repository: createDrizzleWalletMethodsRepository(database),
});

beforeAll(async () => runMigrations(environment));
// Security events keep their session and user (restrict), so they go first; other files clean up without them.
async function clearAccounts() {
  await database.delete(authSecurityEvents);
  await database.delete(releasedWallets);
  await database.delete(authSessions);
  await database.delete(walletChallenges);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
}
beforeEach(async () => {
  await clearAccounts();
  now = new Date("2026-10-13T12:00:00.000Z");
});
afterAll(async () => {
  await clearAccounts();
  await pool.end();
});

// A wallet the test key does not control, put straight on an account: enough to have a second way in.
async function addWallet(userId: UuidV7): Promise<UuidV7> {
  const id = createUuidV7();
  await database.insert(walletIdentities).values({
    address: `tb1q${randomUUID().replaceAll("-", "").slice(0, 30)}`,
    id,
    network: "signet",
    scriptIdentity: randomUUID().replaceAll("-", ""),
    userId,
    walletAdapter: "test",
  });
  return id;
}

async function signIn(): Promise<{
  sessionId: UuidV7;
  token: string;
  userId: UuidV7;
}> {
  const challenge = await auth.issue(validChallengeInput());
  if (challenge === null) throw new Error("challenge refused");
  const result = await auth.verify({
    challengeId: challenge.challengeId,
    signature: signWalletMessage(challenge.message),
  });
  if (!result.ok) throw new Error(`sign-in refused: ${result.code}`);
  return {
    ...(await sessionOf(result.sessionToken)),
    token: result.sessionToken,
    userId: result.userId,
  };
}

async function sessionOf(token: string) {
  const [row] = await database
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, sha256(token)));
  if (row === undefined) throw new Error("no such session");
  return {
    sessionId: createUuidV7Of(row.id),
    userId: createUuidV7Of(row.userId),
  };
}
const createUuidV7Of = (value: string) => value as UuidV7;

async function activeSession(userId: UuidV7, token: string) {
  const [row] = await database
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, sha256(token)));
  return {
    absoluteExpiresAt: row?.absoluteExpiresAt ?? now,
    authenticatedAt: row?.authenticatedAt ?? now,
    idleExpiresAt: row?.idleExpiresAt ?? now,
    sessionId: createUuidV7Of(row?.id ?? ""),
    userId,
  };
}

const walletsOf = async (userId: UuidV7) =>
  database
    .select()
    .from(walletIdentities)
    .where(eq(walletIdentities.userId, userId));

describe("removing a wallet in PostgreSQL", () => {
  it("removes it, holds it, signs every session out, starts a replacement session and records the change", async () => {
    const { token, userId } = await signIn();
    const spare = await addWallet(userId);
    const session = await activeSession(userId, token);
    const outcome = await methods.unlink({
      correlationId: createUuidV7(),
      session,
      walletId: spare,
    });
    if (!outcome.ok) throw new Error(outcome.code);
    expect((await walletsOf(userId)).map(({ address }) => address)).toEqual([
      walletAddress,
    ]);
    const [held] = await database.select().from(releasedWallets);
    expect(held).toMatchObject({ network: "signet", previousUserId: userId });
    expect(held?.heldUntil).toEqual(new Date(now.getTime() + holdMs));
    const sessions = await database.select().from(authSessions);
    expect(
      sessions
        .filter(({ revokedAt }) => revokedAt === null)
        .map(({ tokenHash }) => tokenHash),
    ).toEqual([sha256(outcome.sessionToken)]);
    expect(
      sessions.find(({ tokenHash }) => tokenHash === sha256(token))?.revokedAt,
    ).toEqual(now);
    const [event] = await database.select().from(authSecurityEvents);
    expect(event).toMatchObject({
      action: "wallet-unlinked",
      actorUserId: userId,
    });
    expect(event?.credentialFingerprint).toBe(
      held ? sha256(held.scriptIdentity) : "",
    );
  });

  it("refuses to remove the last wallet, and changes nothing", async () => {
    const { token, userId } = await signIn();
    const [only] = await walletsOf(userId);
    const session = await activeSession(userId, token);
    expect(
      await methods.unlink({
        correlationId: createUuidV7(),
        session,
        walletId: createUuidV7Of(only?.id ?? ""),
      }),
    ).toEqual({ code: "final-method", ok: false });
    expect(await walletsOf(userId)).toHaveLength(1);
    expect(await database.select().from(releasedWallets)).toEqual([]);
    expect(await database.select().from(authSecurityEvents)).toEqual([]);
    const [kept] = await database
      .select()
      .from(authSessions)
      .where(eq(authSessions.tokenHash, sha256(token)));
    expect(kept?.revokedAt).toBeNull();
  });

  it("refuses a wallet that is not the account's, however the id was found, and one that does not exist", async () => {
    const mine = await signIn();
    await addWallet(mine.userId);
    const [theirUser] = await database
      .insert(authUsers)
      .values({
        email: `${randomUUID()}@example.test`,
        id: createUuidV7(),
        name: "Other",
      })
      .returning();
    const theirs = await addWallet(createUuidV7Of(theirUser?.id ?? ""));
    const session = await activeSession(mine.userId, mine.token);
    for (const walletId of [theirs, createUuidV7()])
      expect(
        await methods.unlink({
          correlationId: createUuidV7(),
          session,
          walletId,
        }),
      ).toEqual({ code: "missing", ok: false });
    expect(await walletsOf(createUuidV7Of(theirUser?.id ?? ""))).toHaveLength(
      1,
    );
    expect(await database.select().from(releasedWallets)).toEqual([]);
  });

  it("asks for a fresh signature when the session is no longer recent, and changes nothing", async () => {
    const { token, userId } = await signIn();
    const spare = await addWallet(userId);
    const session = await activeSession(userId, token);
    now = new Date(now.getTime() + 600_001);
    expect(
      await methods.unlink({
        correlationId: createUuidV7(),
        session,
        walletId: spare,
      }),
    ).toEqual({ code: "recent-authentication-required", ok: false });
    expect(await walletsOf(userId)).toHaveLength(2);
  });

  it("lets only one of two removals at once through, so the account keeps a way in", async () => {
    const { token, userId } = await signIn();
    const [first] = await walletsOf(userId);
    const second = await addWallet(userId);
    const session = await activeSession(userId, token);
    const results = await Promise.all([
      methods.unlink({
        correlationId: createUuidV7(),
        session,
        walletId: createUuidV7Of(first?.id ?? ""),
      }),
      methods.unlink({
        correlationId: createUuidV7(),
        session,
        walletId: second,
      }),
    ]);
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(await walletsOf(userId)).toHaveLength(1);
  });

  it("lists the account's wallets, oldest first, with what the owner may see", async () => {
    const { userId } = await signIn();
    await addWallet(userId);
    const listed = await methods.list(userId);
    expect(listed).toHaveLength(2);
    expect(listed[0]).toMatchObject({
      address: walletAddress,
      network: "signet",
      walletAdapter: "lasereyes",
    });
    expect(listed.map(({ network }) => network)).toEqual(["signet", "signet"]);
  });
});

describe("a removed wallet is held", () => {
  async function releaseTestWallet() {
    const { token, userId } = await signIn();
    await addWallet(userId);
    const [mine] = await walletsOf(userId);
    const session = await activeSession(userId, token);
    const outcome = await methods.unlink({
      correlationId: createUuidV7(),
      session,
      walletId: createUuidV7Of(mine?.id ?? ""),
    });
    if (!outcome.ok) throw new Error(outcome.code);
    return { userId };
  }
  const signInAgain = async () => {
    const challenge = await auth.issue(validChallengeInput());
    if (challenge === null) throw new Error("challenge refused");
    return auth.verify({
      challengeId: challenge.challengeId,
      signature: signWalletMessage(challenge.message),
    });
  };

  it("cannot start a new account while it is held, and the refusal is the ordinary conflict", async () => {
    await releaseTestWallet();
    expect(await signInAgain()).toEqual({
      code: "identity-conflict",
      ok: false,
    });
  });

  it("cannot be taken by another account while it is held", async () => {
    await releaseTestWallet();
    const [other] = await database
      .insert(authUsers)
      .values({
        email: `${randomUUID()}@example.test`,
        id: createUuidV7(),
        name: "Other",
      })
      .returning();
    const challenge = await auth.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId: createUuidV7Of(other?.id ?? ""),
    });
    if (challenge === null) throw new Error("challenge refused");
    expect(
      await auth.verify({
        challengeId: challenge.challengeId,
        signature: signWalletMessage(challenge.message),
      }),
    ).toEqual({ code: "identity-conflict", ok: false });
  });

  it("can be taken back at once by the account that removed it, which records the link", async () => {
    const { userId } = await releaseTestWallet();
    const challenge = await auth.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId: userId,
    });
    if (challenge === null) throw new Error("challenge refused");
    const result = await auth.verify({
      challengeId: challenge.challengeId,
      signature: signWalletMessage(challenge.message),
    });
    expect(result.ok && result.userId).toBe(userId);
    expect((await walletsOf(userId)).map(({ address }) => address)).toContain(
      walletAddress,
    );
    const events = await database.select().from(authSecurityEvents);
    expect(events.map(({ action }) => action).sort()).toEqual([
      "wallet-linked",
      "wallet-unlinked",
    ]);
  });

  it("is free for anyone once the hold has passed", async () => {
    await releaseTestWallet();
    now = new Date(now.getTime() + holdMs);
    const result = await signInAgain();
    expect(result.ok).toBe(true);
  });
});
