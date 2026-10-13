import {
  authSecurityEvents,
  authSessions,
  authUsers,
  releasedWallets,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import { walletAddress } from "./support/fixtures.ts";
import {
  activeSession,
  addWallet,
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
    expect(held?.heldUntil).toEqual(new Date(clock.now.getTime() + holdMs));
    const sessions = await database.select().from(authSessions);
    expect(
      sessions
        .filter(({ revokedAt }) => revokedAt === null)
        .map(({ tokenHash }) => tokenHash),
    ).toEqual([sha256(outcome.sessionToken)]);
    expect(
      sessions.find(({ tokenHash }) => tokenHash === sha256(token))?.revokedAt,
    ).toEqual(clock.now);
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
    clock.now = new Date(clock.now.getTime() + 600_001);
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
