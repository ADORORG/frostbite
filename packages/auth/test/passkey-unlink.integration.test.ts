import {
  authSessions,
  authSecurityEvents,
  walletIdentities,
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import {
  activeSessionContext,
  challenge,
  credential,
  database,
  insertCredential,
  repository,
  replacementSession,
  now,
  sessionId,
  userId,
  useWorld,
} from "./support/passkey-world.ts";

useWorld();

describe("Drizzle passkey repository: unlinking", () => {
  it("protects the final way in, and unlinks a passkey once another way to sign in remains", async () => {
    await insertCredential();
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("4"),
        userId,
      }),
    ).resolves.toEqual({ kind: "final-method" });
    // A passkey can sign in, so a second one is a way in on its own.
    await insertCredential("credential-two");
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("5"),
        userId,
      }),
    ).resolves.toEqual({ kind: "unlinked" });
    expect(await repository.listCredentialIds(userId)).toEqual([
      "credential-two",
    ]);
    expect(await database.select().from(authSecurityEvents)).toEqual([
      expect.objectContaining({ action: "passkey-unlinked", sessionId }),
    ]);
  });

  it("unlinks the only passkey when a wallet remains", async () => {
    await insertCredential();
    await database.insert(walletIdentities).values({
      address: "tb1qexample",
      id: createUuidV7(),
      network: "signet",
      scriptIdentity: "0014deadbeef",
      userId,
      walletAdapter: "test",
    });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("4"),
        userId,
      }),
    ).resolves.toEqual({ kind: "unlinked" });
    expect(await repository.listCredentialIds(userId)).toEqual([]);
  });

  it("rejects future-authenticated or revoked bound sessions", async () => {
    const issued = challenge();
    await repository.issueChallenge(issued);
    await insertCredential();
    await database.update(authSessions).set({
      authenticatedAt: new Date(now.getTime() + 1),
    });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("7"),
        userId,
      }),
    ).resolves.toEqual({ kind: "missing" });
    await database
      .update(authSessions)
      .set({ authenticatedAt: now, revokedAt: now });
    await expect(
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential: { ...credential, credentialId: "credential-two" },
        now,
        replacementSession: replacementSession("6"),
      }),
    ).resolves.toEqual({ kind: "invalid" });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("8"),
        userId,
      }),
    ).resolves.toEqual({ kind: "missing" });
  });
});
