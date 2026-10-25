import { authSecurityEvents, authSessions, contactCodes } from "@ador/database";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import {
  change,
  identities,
  linkCode,
  links,
  window,
} from "./support/contact-link-world.ts";
import {
  clock,
  database,
  issueInput,
  repository,
  signedInAccount,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

describe("linking an address", () => {
  it("adds it to the account, signs every session out, starts the new one and records it without the address", async () => {
    const account = await signedInAccount({ address: "old@example.com" });
    const code = await linkCode(account.userId);
    const input = change(account);
    expect(await links.completeLink({ ...input, codeId: code.id })).toEqual({
      kind: "linked",
    });
    const held = await identities();
    expect(held.map(({ value }) => value).sort()).toEqual([
      "new@example.com",
      "old@example.com",
    ]);
    expect(
      held.find(({ value }) => value === "new@example.com")?.verifiedAt,
    ).toEqual(clock.now);
    const sessions = await database.select().from(authSessions);
    const live = sessions.filter(({ revokedAt }) => revokedAt === null);
    expect(live).toHaveLength(1);
    expect(live[0]?.tokenHash).toBe(input.replacementSession.tokenHash);
    expect(
      sessions.find(({ id }) => id === account.sessionId)?.revokedAt,
    ).toEqual(clock.now);
    const [event] = await database.select().from(authSecurityEvents);
    expect(event).toMatchObject({
      action: "email-linked",
      actorUserId: account.userId,
      correlationId: input.correlationId,
    });
    expect(event?.credentialFingerprint).toBe(sha256("email:new@example.com"));
    expect(JSON.stringify(event)).not.toContain("new@example.com");
    expect(live[0]?.id).toBe(event?.sessionId);
  });

  it("spends the code, so it cannot link again", async () => {
    const account = await signedInAccount({ address: "old@example.com" });
    const code = await linkCode(account.userId);
    await links.completeLink({ ...change(account), codeId: code.id });
    const [row] = await database
      .select()
      .from(contactCodes)
      .where(eq(contactCodes.id, code.id));
    expect(row?.consumedAt).toEqual(clock.now);
  });

  it("lets exactly one of several simultaneous attempts with one code link", async () => {
    const account = await signedInAccount({ address: "old@example.com" });
    const code = await linkCode(account.userId);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        links.completeLink({ ...change(account), codeId: code.id }),
      ),
    );
    expect(results.filter(({ kind }) => kind === "linked")).toHaveLength(1);
    expect(await database.select().from(authSecurityEvents)).toHaveLength(1);
    expect(
      (await identities()).filter(({ value }) => value === "new@example.com"),
    ).toHaveLength(1);
  });

  it("answers that the account already holds it, changing and signing out nothing", async () => {
    const account = await signedInAccount({ address: "mine@example.com" });
    const code = await linkCode(account.userId, "mine@example.com");
    expect(
      await links.completeLink({
        ...change(account, "mine@example.com"),
        codeId: code.id,
      }),
    ).toEqual({ kind: "already-linked" });
    expect(await database.select().from(authSecurityEvents)).toEqual([]);
    expect(
      (await database.select().from(authSessions)).filter(
        ({ revokedAt }) => revokedAt === null,
      ),
    ).toHaveLength(1);
  });

  it("refuses an address another account holds, spends the code, and moves nothing", async () => {
    const other = await signedInAccount({ address: "taken@example.com" });
    const account = await signedInAccount({ address: "old@example.com" });
    const code = await linkCode(account.userId, "taken@example.com");
    expect(
      await links.completeLink({
        ...change(account, "taken@example.com"),
        codeId: code.id,
      }),
    ).toEqual({ kind: "taken" });
    expect(
      (await identities()).find(({ value }) => value === "taken@example.com")
        ?.userId,
    ).toBe(other.userId);
    expect(
      (
        await database
          .select()
          .from(contactCodes)
          .where(eq(contactCodes.id, code.id))
      )[0]?.consumedAt,
    ).not.toBeNull();
    expect(await database.select().from(authSecurityEvents)).toEqual([]);
  });

  it("refuses a code that was sent for something else, to someone else, or that has expired or been replaced", async () => {
    const account = await signedInAccount({ address: "old@example.com" });
    const other = await signedInAccount({ address: "other@example.com" });
    const signInCode = issueInput({ destination: "new@example.com" });
    await repository.issue(signInCode);
    expect(
      await links.completeLink({ ...change(account), codeId: signInCode.id }),
    ).toEqual({ kind: "code-spent" });
    const theirs = await linkCode(other.userId, "x@example.com");
    expect(
      await links.completeLink({
        ...change(account, "x@example.com"),
        codeId: theirs.id,
      }),
    ).toEqual({ kind: "code-spent" });
    const stale = await linkCode(account.userId, "late@example.com");
    expect(
      await links.completeLink({
        ...change(account, "late@example.com", stale.expiresAt),
        codeId: stale.id,
      }),
    ).toEqual({ kind: "code-spent" });
    const first = await linkCode(account.userId, "again@example.com");
    await linkCode(account.userId, "again@example.com", 60_000);
    expect(
      await links.completeLink({
        ...change(account, "again@example.com"),
        codeId: first.id,
      }),
    ).toEqual({ kind: "code-spent" });
    expect((await identities()).map(({ value }) => value).sort()).toEqual([
      "old@example.com",
      "other@example.com",
    ]);
  });

  it("refuses from a session that is no longer recent, to the millisecond, and leaves the code unspent", async () => {
    const account = await signedInAccount({
      address: "old@example.com",
      authenticatedAt: new Date(start.getTime() - window - 1),
    });
    const code = await linkCode(account.userId);
    expect(
      await links.completeLink({ ...change(account), codeId: code.id }),
    ).toEqual({ kind: "session-not-recent" });
    expect(
      await database
        .select()
        .from(contactCodes)
        .where(
          and(eq(contactCodes.id, code.id), isNull(contactCodes.consumedAt)),
        ),
    ).toHaveLength(1);
    const fresh = await signedInAccount({
      address: "f@example.com",
      authenticatedAt: new Date(start.getTime() - window),
    });
    const freshCode = await linkCode(fresh.userId, "g@example.com");
    expect(
      (
        await links.completeLink({
          ...change(fresh, "g@example.com"),
          codeId: freshCode.id,
        })
      ).kind,
    ).toBe("linked");
  });
});
