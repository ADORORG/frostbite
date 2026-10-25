import {
  authSessions,
  authSecurityEvents,
  authUsers,
  passkeyCredentials,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import {
  activeSessionContext,
  challenge,
  credential,
  database,
  repository,
  replacementSession,
  now,
  sessionId,
  userId,
  useWorld,
} from "./support/passkey-world.ts";

useWorld();

describe("Drizzle passkey repository", () => {
  it("allows one concurrent link, consumes once, and rotates sessions", async () => {
    const issued = challenge();
    await repository.issueChallenge(issued);
    const stored = await repository.findChallenge(issued.challengeId);
    expect(stored).toEqual(issued);
    const results = await Promise.all([
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential,
        now,
        replacementSession: replacementSession("3"),
      }),
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential,
        now,
        replacementSession: replacementSession("4"),
      }),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "linked",
      "replayed",
    ]);
    expect(await repository.listCredentialIds(userId)).toEqual([
      "credential-one",
    ]);
    const sessions = await database.select().from(authSessions);
    expect(sessions.filter(({ revokedAt }) => revokedAt === null)).toHaveLength(
      1,
    );
    const events = await database.select().from(authSecurityEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "passkey-linked",
      actorUserId: userId,
      sessionId,
    });
    expect(events[0]?.credentialFingerprint).not.toContain("credential-one");
  });

  it("returns a generic conflict when another user owns the credential", async () => {
    const issued = challenge();
    await repository.issueChallenge(issued);
    const otherUserId = createUuidV7();
    await database.insert(authUsers).values({
      email: `${otherUserId}@wallet.invalid`,
      id: otherUserId,
      name: "Other",
    });
    await database.insert(passkeyCredentials).values({
      ...credential,
      id: createUuidV7(),
      publicKey: Buffer.from(credential.publicKey),
      transports: [...credential.transports],
      userId: otherUserId,
    });
    await expect(
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential,
        now,
        replacementSession: replacementSession("3"),
      }),
    ).resolves.toEqual({ kind: "conflict" });
    expect(
      (await repository.findChallenge(issued.challengeId))?.consumedAt,
    ).toEqual(now);
  });

  it.each([
    ["challengeHash", "3".repeat(64)],
    ["origin", "https://wrong.invalid"],
    ["relyingPartyId", "wrong.invalid"],
    ["sessionId", createUuidV7()],
    ["userId", createUuidV7()],
    ["issuedAt", new Date(now.getTime() - 1)],
    ["expiresAt", now],
  ] as const)(
    "rejects a challenge whose %s no longer matches",
    async (field, value) => {
      const issued = challenge();
      await repository.issueChallenge(issued);
      await expect(
        repository.completeLink({
          ...activeSessionContext(),
          challenge: { ...issued, [field]: value },
          credential,
          now,
          replacementSession: replacementSession("3"),
        }),
      ).resolves.toEqual({ kind: "invalid" });
      expect(await repository.listCredentialIds(userId)).toEqual([]);
    },
  );

  it("treats a missing challenge and another user's credential as unavailable", async () => {
    await expect(repository.findChallenge(createUuidV7())).resolves.toBeNull();
    await expect(
      repository.completeLink({
        ...activeSessionContext(),
        challenge: challenge(),
        credential,
        now,
        replacementSession: replacementSession("3"),
      }),
    ).resolves.toEqual({ kind: "replayed" });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: "missing",
        now,
        replacementSession: replacementSession("4"),
        userId,
      }),
    ).resolves.toEqual({ kind: "missing" });
  });
});
