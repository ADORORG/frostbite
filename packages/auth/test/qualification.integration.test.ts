import {
  authSessions,
  authUsers,
  walletIdentities,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { walletQualificationChallenges } from "@ador/database/schema/wallet-qualification";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createWalletQualificationService } from "../src/qualification/service.ts";
import { createDrizzleQualificationRepository } from "../src/qualification/drizzle-repository.ts";
import { strictBip322Verifier } from "../src/bitcoin/verifier.ts";
import { signWalletMessage, walletAddress } from "./support/fixtures.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleQualificationRepository(database);
let now = new Date("2026-10-04T12:00:00Z");
const policy = {
  lifetimeMs: 300_000,
  maximumAttempts: 2,
  network: "signet",
  origin: "https://launch.example",
  providers: ["xverse"],
} as const;
const service = createWalletQualificationService({
  policy,
  repository,
  verifier: strictBip322Verifier,
  clock: () => now,
});
const input = {
  address: walletAddress,
  provider: "xverse",
  network: "signet",
} as const;
async function issue() {
  const challenge = await service.begin(input);
  if (!challenge) throw new Error("Expected challenge");
  return challenge;
}
beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(walletQualificationChallenges);
  now = new Date("2026-10-04T12:00:00Z");
});
afterAll(async () => pool.end());

describe("qualification without authentication", () => {
  it("rejects expiry crossed during real signature verification", async () => {
    const challenge = await issue();
    const deadline = new Date(challenge.expiresAt);
    now = new Date(deadline.getTime() - 1);
    const crossingService = createWalletQualificationService({
      policy,
      repository,
      clock: () => now,
      verifier: {
        verify(value) {
          const valid = strictBip322Verifier.verify(value);
          now = deadline;
          return valid;
        },
      },
    });
    expect(
      await crossingService.verify({
        challengeId: challenge.challengeId,
        message: challenge.message,
        signature: signWalletMessage(challenge.message),
      }),
    ).toBe(false);
    const [stored] = await database
      .select()
      .from(walletQualificationChallenges);
    expect(stored?.consumedAt).toBeNull();
    expect(stored?.attempts).toBe(0);
  });

  it("verifies a real BIP-322 signature without creating an identity, user, or session", async () => {
    const users = await database.select().from(authUsers);
    const identities = await database.select().from(walletIdentities);
    const sessions = await database.select().from(authSessions);
    const challenge = await issue();
    expect(challenge.message).toContain(
      "does not sign you in, create a session",
    );
    const signature = signWalletMessage(challenge.message);
    expect(
      await service.verify({
        challengeId: challenge.challengeId,
        message: challenge.message,
        signature,
      }),
    ).toBe(true);
    expect(await database.select().from(authUsers)).toEqual(users);
    expect(await database.select().from(walletIdentities)).toEqual(identities);
    expect(await database.select().from(authSessions)).toEqual(sessions);
    const [stored] = await database
      .select()
      .from(walletQualificationChallenges);
    expect(stored?.consumedAt).toEqual(now);
    expect(stored?.messageHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(stored)).not.toContain(challenge.message);
    expect(JSON.stringify(stored)).not.toContain(signature);
    expect(
      await service.verify({
        challengeId: challenge.challengeId,
        message: challenge.message,
        signature,
      }),
    ).toBe(false);
  });

  it("allows one concurrent successful verification only", async () => {
    const challenge = await issue();
    const verify = {
      challengeId: challenge.challengeId,
      message: challenge.message,
      signature: signWalletMessage(challenge.message),
    };
    expect(
      (
        await Promise.all([service.verify(verify), service.verify(verify)])
      ).sort(),
    ).toEqual([false, true]);
  });

  it("samples settlement time after a competing row lock is released", async () => {
    const challenge = await issue();
    now = new Date(new Date(challenge.expiresAt).getTime() - 1);
    let settlement: Promise<boolean> | undefined;
    await database.transaction(async (transaction) => {
      await transaction
        .select()
        .from(walletQualificationChallenges)
        .where(eq(walletQualificationChallenges.id, challenge.challengeId))
        .for("update");
      settlement = repository.settle(
        uuidV7Schema.parse(challenge.challengeId),
        true,
        () => now,
        policy.maximumAttempts,
      );
      now = new Date(challenge.expiresAt);
    });
    expect(await settlement).toBe(false);
    const [stored] = await database
      .select()
      .from(walletQualificationChallenges);
    expect(stored?.consumedAt).toBeNull();
  });

  it("rejects edited messages, invalid signatures, and exhausted attempts", async () => {
    const challenge = await issue();
    const verify = {
      challengeId: challenge.challengeId,
      message: challenge.message,
      signature: signWalletMessage(challenge.message),
    };
    expect(
      await service.verify({
        ...verify,
        message: `${challenge.message} edited`,
        signature: signWalletMessage(`${challenge.message} edited`),
      }),
    ).toBe(false);
    expect(await service.verify({ ...verify, signature: "invalid" })).toBe(
      false,
    );
    expect(await service.verify(verify)).toBe(false);
    const [stored] = await database
      .select()
      .from(walletQualificationChallenges);
    expect(stored?.attempts).toBe(2);
    expect(stored?.consumedAt).toBeNull();
  });

  it("rejects expiry at its exact boundary and missing challenges", async () => {
    const challenge = await issue();
    now = new Date(challenge.expiresAt);
    expect(
      await service.verify({
        challengeId: challenge.challengeId,
        message: challenge.message,
        signature: signWalletMessage(challenge.message),
      }),
    ).toBe(false);
    expect(
      await service.verify({
        challengeId: createUuidV7(),
        message: challenge.message,
        signature: "invalid",
      }),
    ).toBe(false);
    expect(
      await service.verify({
        challengeId: "not-an-id",
        message: challenge.message,
        signature: "invalid",
      }),
    ).toBe(false);
    expect(
      await repository.settle(
        uuidV7Schema.parse(challenge.challengeId),
        true,
        () => now,
        policy.maximumAttempts,
      ),
    ).toBe(false);
  });

  it("bounds concurrent failed settlements at the repository boundary", async () => {
    const challenge = await issue();
    const id = uuidV7Schema.parse(challenge.challengeId);
    const settled = await Promise.all(
      Array.from({ length: policy.maximumAttempts + 2 }, () =>
        repository.settle(id, false, () => now, policy.maximumAttempts),
      ),
    );
    expect(settled.filter(Boolean)).toHaveLength(policy.maximumAttempts);
    const [stored] = await database
      .select()
      .from(walletQualificationChallenges);
    expect(stored?.attempts).toBe(policy.maximumAttempts);
    expect(stored?.consumedAt).toBeNull();
  });

  it("binds origin and validates persisted addresses before cryptography", async () => {
    const challenge = await issue();
    const verify = {
      challengeId: challenge.challengeId,
      message: challenge.message,
      signature: signWalletMessage(challenge.message),
    };
    const otherOrigin = createWalletQualificationService({
      policy: { ...policy, origin: "https://other.example" },
      repository,
      verifier: strictBip322Verifier,
      clock: () => now,
    });
    expect(await otherOrigin.verify(verify)).toBe(false);
    await database
      .update(walletQualificationChallenges)
      .set({ address: "invalid" })
      .where(eq(walletQualificationChallenges.id, challenge.challengeId));
    expect(await service.verify(verify)).toBe(false);
  });

  it("rejects invalid addresses, networks, and unconfigured providers before persistence", async () => {
    expect(await service.begin({ ...input, address: "invalid" })).toBeNull();
    expect(await service.begin({ ...input, network: "mainnet" })).toBeNull();
    expect(await service.begin({ ...input, provider: "other" })).toBeNull();
    expect(await database.select().from(walletQualificationChallenges)).toEqual(
      [],
    );
  });

  it("enforces hash and attempt constraints in PostgreSQL", async () => {
    const challenge = await issue();
    await expect(
      database
        .update(walletQualificationChallenges)
        .set({ messageHash: "bad" })
        .where(eq(walletQualificationChallenges.id, challenge.challengeId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(
      database
        .update(walletQualificationChallenges)
        .set({ attempts: -1 })
        .where(eq(walletQualificationChallenges.id, challenge.challengeId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
