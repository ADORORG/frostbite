import { authSecurityEvents, authUsers } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  signWalletMessage,
  validChallengeInput,
  walletAddress,
} from "./support/fixtures.ts";
import {
  activeSession,
  addWallet,
  auth,
  clock,
  createUuidV7Of,
  database,
  holdMs,
  methods,
  registerWalletMethodsDatabase,
  signIn,
  walletsOf,
} from "./support/wallet-methods-database.ts";

registerWalletMethodsDatabase();

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
      expectedAction: "sign-in",
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
        expectedAction: "link-wallet",
        expectedUserId: createUuidV7Of(other?.id ?? ""),
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
      expectedAction: "link-wallet",
      expectedUserId: userId,
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
    clock.now = new Date(clock.now.getTime() + holdMs);
    const result = await signInAgain();
    expect(result.ok).toBe(true);
  });
});
