import {
  authSessions,
  authUsers,
  walletChallenges,
  walletIdentities,
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDrizzleSessionRepository } from "../src/adapters/drizzle-session-repository.ts";
import { createSessionService } from "../src/application/session-service.ts";
import { walletAuthPolicy, validChallengeInput } from "./support/fixtures.ts";
import {
  clock,
  database,
  issue,
  registerAuthDatabase,
  service,
  verifyIssued,
} from "./support/auth-database.ts";

registerAuthDatabase();

describe("wallet challenges and sessions, guarded", () => {
  it("signs out one session by its id, only for its own user and only once", async () => {
    const result = await verifyIssued(await issue());
    if (!result.ok) throw new Error("Expected authentication success");
    const sessions = createSessionService({
      clock: () => clock.now,
      idleLifetimeMs: walletAuthPolicy.sessionIdleLifetimeMs,
      repository: createDrizzleSessionRepository(database),
    });
    const active = await sessions.find(result.sessionToken);
    if (active === null) throw new Error("Expected an active session");
    await expect(
      sessions.revokeSession({
        sessionId: active.sessionId,
        userId: createUuidV7(),
      }),
    ).resolves.toBe(false);
    await expect(sessions.find(result.sessionToken)).resolves.not.toBeNull();
    await expect(sessions.revokeSession(active)).resolves.toBe(true);
    await expect(sessions.revokeSession(active)).resolves.toBe(false);
    await expect(sessions.find(result.sessionToken)).resolves.toBeNull();
  });

  it("refuses a challenge made for another action or another account, before anything changes", async () => {
    const owner = createUuidV7();
    await database.insert(authUsers).values({
      email: `wallet-${owner}@wallet.invalid`,
      id: owner,
      name: "Owner",
    });
    const link = await service.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId: owner,
    });
    if (link === null) throw new Error("Expected link challenge");
    const refused = { code: "challenge-invalid", ok: false };
    // A link challenge cannot be used to sign in, to step up, or from another account's session.
    await expect(
      verifyIssued(link, { expectedAction: "sign-in" }),
    ).resolves.toEqual(refused);
    await expect(
      verifyIssued(link, { expectedAction: "link-wallet" }),
    ).resolves.toEqual(refused);
    await expect(
      verifyIssued(link, {
        expectedAction: "link-wallet",
        expectedUserId: createUuidV7(),
      }),
    ).resolves.toEqual(refused);
    await expect(
      verifyIssued(link, { expectedAction: "step-up", expectedUserId: owner }),
    ).resolves.toEqual(refused);
    // Nothing was consumed or created by the refusals, so the right caller can still finish it.
    expect(await database.select().from(walletIdentities)).toHaveLength(0);
    expect(await database.select().from(authSessions)).toHaveLength(0);
    await expect(
      verifyIssued(link, {
        expectedAction: "link-wallet",
        expectedUserId: owner,
      }),
    ).resolves.toMatchObject({ ok: true, userId: owner });
    // And a sign-in challenge cannot be completed as a link.
    const signIn = await issue();
    await expect(
      verifyIssued(signIn, {
        expectedAction: "link-wallet",
        expectedUserId: owner,
      }),
    ).resolves.toEqual(refused);
  });

  it("enforces protocol and hash invariants in PostgreSQL", async () => {
    const issued = await issue();
    await expect(
      database
        .update(walletChallenges)
        .set({ messageHash: "not-a-sha256-hash" })
        .where(eq(walletChallenges.id, issued.challengeId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(
      database
        .update(walletChallenges)
        .set({ network: "testnet" })
        .where(eq(walletChallenges.id, issued.challengeId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });

    const result = await verifyIssued(issued);
    if (!result.ok) throw new Error("Expected authentication success");
    await expect(
      database.update(authSessions).set({ tokenHash: result.sessionToken }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
