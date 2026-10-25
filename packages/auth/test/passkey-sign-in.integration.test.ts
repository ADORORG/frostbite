import {
  authSecurityEvents,
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  passkeyChallenges,
  passkeyCredentials,
  passkeySignInChallenges,
  runMigrations,
  walletIdentities,
} from "@ador/database";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import { createDrizzlePasskeySignInRepository } from "../src/passkeys/drizzle-sign-in-repository.ts";
import type { PasskeyAuthenticationAdapter } from "../src/passkeys/sign-in-contracts.ts";
import { createPasskeySignInService } from "../src/passkeys/sign-in-service.ts";
import { simpleWebAuthnAuthenticationAdapter } from "../src/passkeys/simplewebauthn-authentication.ts";
import { createSoftwareAuthenticator } from "./support/software-authenticator.ts";

// Signing in with a passkey end to end: the vendor library checks real signatures from a software authenticator, and the repository is
// the real one on real PostgreSQL.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const origin = "https://launch.invalid";
const relyingPartyId = "launch.invalid";
const clock = { now: new Date("2026-10-25T12:00:00.000Z") };
// A pause inside verification, to hold two sign-ins open at once so they overlap every time rather than when the timing allows.
const slow = { delayMs: 0 };
const adapter: PasskeyAuthenticationAdapter = {
  createOptions: simpleWebAuthnAuthenticationAdapter.createOptions,
  verify: async (input) => {
    if (slow.delayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, slow.delayMs));
    return simpleWebAuthnAuthenticationAdapter.verify(input);
  },
};
const service = createPasskeySignInService({
  adapter,
  clock: () => clock.now,
  policy: {
    challengeLifetimeMs: 60_000,
    expectedOrigin: origin,
    relyingPartyId,
    sessionAbsoluteLifetimeMs: 3_600_000,
    sessionIdleLifetimeMs: 600_000,
  },
  repository: createDrizzlePasskeySignInRepository(database),
});

async function enrol(counter = 0) {
  const authenticator = await createSoftwareAuthenticator();
  const userId = createUuidV7();
  await database.insert(authUsers).values({
    email: `${userId}@example.test`,
    id: userId,
    name: "Passkey person",
  });
  await database.insert(passkeyCredentials).values({
    backedUp: true,
    counter,
    credentialId: authenticator.credentialId,
    deviceType: "multiDevice",
    id: createUuidV7(),
    publicKey: Buffer.from(authenticator.publicKey),
    transports: ["internal", "unknown-transport"],
    userId,
  });
  return { authenticator, userId };
}
async function signed(
  authenticator: Awaited<ReturnType<typeof createSoftwareAuthenticator>>,
  counter: number,
  challenge?: Awaited<ReturnType<typeof service.begin>>,
) {
  const begun = challenge ?? (await service.begin());
  return {
    begun,
    payload: await authenticator.assert({
      challenge: begun.options.challenge,
      counter,
      origin,
      relyingPartyId,
    }),
  };
}
const sessionsOf = (userId: UuidV7) =>
  database.select().from(authSessions).where(eq(authSessions.userId, userId));
const counterOf = async (credentialId: string) =>
  (
    await database
      .select()
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.credentialId, credentialId))
  )[0]?.counter;

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  clock.now = new Date("2026-10-25T12:00:00.000Z");
  slow.delayMs = 0;
  await database.delete(authSecurityEvents);
  await database.delete(passkeySignInChallenges);
  await database.delete(passkeyChallenges);
  await database.delete(passkeyCredentials);
  await database.delete(authSessions);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

describe("signing in with a passkey", () => {
  it("starts a session for the account the credential belongs to, and moves the counter", async () => {
    const { authenticator, userId } = await enrol(4);
    const { begun, payload } = await signed(authenticator, 5);
    const result = await service.finish({
      challengeId: begun.challengeId,
      payload,
    });
    if (!result.ok) throw new Error(`expected a sign-in, got ${result.code}`);
    const [session] = await sessionsOf(userId);
    expect(session).toMatchObject({
      absoluteExpiresAt: new Date(clock.now.getTime() + 3_600_000),
      authenticatedAt: clock.now,
      tokenHash: sha256(result.sessionToken),
    });
    expect(await counterOf(authenticator.credentialId)).toBe(5);
  });

  it("stores only the hash of the challenge", async () => {
    const begun = await service.begin();
    const [row] = await database.select().from(passkeySignInChallenges);
    expect(row?.challengeHash).toBe(sha256(begun.options.challenge));
    expect(JSON.stringify(row)).not.toContain(begun.options.challenge);
  });

  it("answers a second use of the same response as a replay: no second session", async () => {
    const { authenticator, userId } = await enrol();
    const { begun, payload } = await signed(authenticator, 1);
    const input = { challengeId: begun.challengeId, payload };
    expect((await service.finish(input)).ok).toBe(true);
    expect(await service.finish(input)).toEqual({
      code: "challenge-invalid",
      ok: false,
    });
    expect(await sessionsOf(userId)).toHaveLength(1);
  });

  it("spends the challenge even when the answer is wrong, so there is one try per challenge", async () => {
    const { authenticator } = await enrol();
    const begun = await service.begin();
    const wrong = await authenticator.assert({
      challenge: begun.options.challenge,
      counter: 1,
      origin: "https://attacker.invalid",
      relyingPartyId,
    });
    expect(
      await service.finish({ challengeId: begun.challengeId, payload: wrong }),
    ).toEqual({ code: "not-verified", ok: false });
    const right = await signed(authenticator, 1, begun);
    expect(
      await service.finish({
        challengeId: begun.challengeId,
        payload: right.payload,
      }),
    ).toEqual({ code: "challenge-invalid", ok: false });
  });

  it("lets only one of several simultaneous attempts at one challenge through", async () => {
    const { authenticator, userId } = await enrol();
    const { begun, payload } = await signed(authenticator, 1);
    slow.delayMs = 40;
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        service.finish({ challengeId: begun.challengeId, payload }),
      ),
    );
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(await sessionsOf(userId)).toHaveLength(1);
  });

  it("refuses an expired challenge, to the millisecond", async () => {
    const { authenticator, userId } = await enrol();
    const { begun, payload } = await signed(authenticator, 1);
    clock.now = new Date(clock.now.getTime() + 60_000);
    expect(
      await service.finish({ challengeId: begun.challengeId, payload }),
    ).toEqual({ code: "challenge-invalid", ok: false });
    expect(await sessionsOf(userId)).toHaveLength(0);
  });

  it("still works one millisecond before the challenge expires", async () => {
    const { authenticator } = await enrol();
    const { begun, payload } = await signed(authenticator, 1);
    clock.now = new Date(clock.now.getTime() + 59_999);
    expect(
      (await service.finish({ challengeId: begun.challengeId, payload })).ok,
    ).toBe(true);
  });

  it("refuses a credential that was never enrolled, and an unknown challenge, with nothing created", async () => {
    const stranger = await createSoftwareAuthenticator();
    const { begun, payload } = await signed(stranger, 1);
    expect(
      await service.finish({ challengeId: begun.challengeId, payload }),
    ).toEqual({ code: "credential-unknown", ok: false });
    expect(
      await service.finish({ challengeId: createUuidV7(), payload }),
    ).toEqual({ code: "challenge-invalid", ok: false });
    expect(await database.select().from(authSessions)).toHaveLength(0);
  });

  it("refuses a response that does not move the counter forward, leaving the counter alone", async () => {
    const { authenticator, userId } = await enrol(7);
    const { begun, payload } = await signed(authenticator, 7);
    expect(
      await service.finish({ challengeId: begun.challengeId, payload }),
    ).toEqual({ code: "not-verified", ok: false });
    expect(await counterOf(authenticator.credentialId)).toBe(7);
    expect(await sessionsOf(userId)).toHaveLength(0);
  });

  it("lets only one of two sign-ins that use the same counter value through, which is what a cloned authenticator would do", async () => {
    const { authenticator, userId } = await enrol(2);
    const first = await signed(authenticator, 3);
    const second = await signed(authenticator, 3);
    slow.delayMs = 40;
    const results = await Promise.all([
      service.finish({
        challengeId: first.begun.challengeId,
        payload: first.payload,
      }),
      service.finish({
        challengeId: second.begun.challengeId,
        payload: second.payload,
      }),
    ]);
    expect(results.map(({ ok }) => ok).sort()).toEqual([false, true]);
    expect(results.find(({ ok }) => !ok)).toEqual({
      code: "counter-conflict",
      ok: false,
    });
    expect(await sessionsOf(userId)).toHaveLength(1);
    expect(await counterOf(authenticator.credentialId)).toBe(3);
  });

  it("keeps another browser's session when this one signs in", async () => {
    const { authenticator, userId } = await enrol();
    const one = await signed(authenticator, 1);
    const two = await signed(authenticator, 2);
    await service.finish({
      challengeId: one.begun.challengeId,
      payload: one.payload,
    });
    await service.finish({
      challengeId: two.begun.challengeId,
      payload: two.payload,
    });
    const sessions = await sessionsOf(userId);
    expect(sessions).toHaveLength(2);
    expect(sessions.every(({ revokedAt }) => revokedAt === null)).toBe(true);
  });
});
