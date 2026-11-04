import {
  authSecurityEvents,
  authSessions,
  contactCodes,
  contactIdentities,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  change,
  identities,
  linkCode,
  links,
  maximumAddresses,
} from "./support/contact-link-world.ts";
import {
  clock,
  database,
  signedInAccount,
  signedInAccountSession,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

// Gives the account more addresses, each added a minute after the one before, so the order they are listed in is known.
async function hold(userId: string, count: number, from = 1) {
  for (let at = from; at < from + count; at += 1)
    await database.insert(contactIdentities).values({
      createdAt: new Date(start.getTime() + at * 60_000),
      id: createUuidV7(),
      kind: "email",
      userId,
      value: `held${String(at)}@example.com`,
      verifiedAt: new Date(start.getTime() + at * 60_000),
    });
}
// The session the account has now: a link or an unlink signs the others out and starts a new one.
async function liveSession(userId: string) {
  const row = (await database.select().from(authSessions)).find(
    (each) => each.userId === userId && each.revokedAt === null,
  );
  if (row === undefined) throw new Error("no live session");
  return { sessionId: row.id, userId };
}
const total = async (userId: string) =>
  (await identities()).filter((row) => row.userId === userId).length;

describe("how many addresses an account may hold", () => {
  it("adds addresses up to the limit and refuses the next one, spending its code and changing nothing else", async () => {
    const account = await signedInAccount({ address: "first@example.com" });
    await hold(account.userId, maximumAddresses - 2);
    expect(await total(account.userId)).toBe(maximumAddresses - 1);
    const last = await linkCode(account.userId, "last@example.com");
    expect(
      await links.completeLink({
        ...change(account, "last@example.com"),
        codeId: last.id,
      }),
    ).toEqual({ kind: "linked" });
    expect(await total(account.userId)).toBe(maximumAddresses);

    const events = (await database.select().from(authSecurityEvents)).length;
    const sessions = await database.select().from(authSessions);
    const over = await linkCode(account.userId, "over@example.com", 120_000);
    expect(
      await links.completeLink({
        ...change(await liveSession(account.userId), "over@example.com"),
        codeId: over.id,
      }),
    ).toEqual({ kind: "limit-reached" });
    expect(await total(account.userId)).toBe(maximumAddresses);
    // Nothing was added, nobody was signed out, nothing was recorded; the code is spent, so it cannot be tried again later.
    expect(await database.select().from(authSecurityEvents)).toHaveLength(
      events,
    );
    expect(await database.select().from(authSessions)).toEqual(sessions);
    expect(
      (
        await database
          .select()
          .from(contactCodes)
          .where(eq(contactCodes.id, over.id))
      )[0]?.consumedAt,
    ).not.toBeNull();
  });

  it("lets an address the account already holds through at the limit, since nothing is added", async () => {
    const account = await signedInAccount({ address: "mine@example.com" });
    await hold(account.userId, maximumAddresses - 1);
    const code = await linkCode(account.userId, "mine@example.com");
    expect(
      await links.completeLink({
        ...change(account, "mine@example.com"),
        codeId: code.id,
      }),
    ).toEqual({ kind: "already-linked" });
  });

  it("answers taken, not limit, for an address another account holds, so the limit says nothing about other accounts", async () => {
    await signedInAccount({ address: "theirs@example.com" });
    const account = await signedInAccount({ address: "mine@example.com" });
    await hold(account.userId, maximumAddresses - 1);
    const code = await linkCode(account.userId, "theirs@example.com");
    expect(
      await links.completeLink({
        ...change(account, "theirs@example.com"),
        codeId: code.id,
      }),
    ).toEqual({ kind: "taken" });
  });

  it("makes room when one is removed", async () => {
    const account = await signedInAccount({ address: "first@example.com" });
    await hold(account.userId, maximumAddresses - 1);
    const refused = await linkCode(account.userId, "new@example.com");
    expect(
      await links.completeLink({ ...change(account), codeId: refused.id }),
    ).toEqual({ kind: "limit-reached" });
    expect(await links.unlink(change(account, "held1@example.com"))).toEqual({
      kind: "unlinked",
    });
    // A new code for the same address: the refused one was spent, and the cooldown between two codes to one address has passed.
    const again = await linkCode(account.userId, "new@example.com", 120_000);
    expect(
      await links.completeLink({
        ...change(await liveSession(account.userId)),
        codeId: again.id,
      }),
    ).toEqual({ kind: "linked" });
    expect(await total(account.userId)).toBe(maximumAddresses);
  });

  it("holds the limit, and fails none of them, when sessions of one account add different addresses at the same moment", async () => {
    const account = await signedInAccount({ address: "first@example.com" });
    await hold(account.userId, maximumAddresses - 2);
    // One address of room left and several sessions each adding its own address. Exactly one may win, the others are turned away
    // (the limit, or the session the winner signed out), and none may fail: two changes waiting on each other must not deadlock.
    const attempts = await Promise.all(
      Array.from({ length: 6 }, async (_, at) => {
        const sessionId = await signedInAccountSession(account.userId);
        const address = `race${String(at)}@example.com`;
        const code = await linkCode(account.userId, address, 3_000 + at);
        return links.completeLink({
          ...change({ sessionId, userId: account.userId }, address),
          codeId: code.id,
        });
      }),
    );
    expect(attempts.filter(({ kind }) => kind === "linked")).toHaveLength(1);
    expect(
      attempts.every(({ kind }) =>
        ["limit-reached", "linked", "session-not-recent"].includes(kind),
      ),
    ).toBe(true);
    expect(await total(account.userId)).toBe(maximumAddresses);
  });

  it("counts each account's addresses on their own", async () => {
    const full = await signedInAccount({ address: "full@example.com" });
    await hold(full.userId, maximumAddresses - 1);
    const other = await signedInAccount({ address: "other@example.com" });
    const code = await linkCode(other.userId, "more@example.com");
    expect(
      await links.completeLink({
        ...change(other, "more@example.com"),
        codeId: code.id,
      }),
    ).toEqual({ kind: "linked" });
  });

  it("lists an account's addresses oldest first, each with when it was added", async () => {
    const account = await signedInAccount({ address: "first@example.com" });
    await hold(account.userId, 1);
    const code = await linkCode(account.userId, "added@example.com");
    // Within the recent-sign-in window of the session that makes the change.
    clock.now = new Date(start.getTime() + 300_000);
    await links.completeLink({
      ...change(account, "added@example.com", clock.now),
      codeId: code.id,
    });
    expect(await links.list(account.userId, "email")).toEqual([
      { addedAt: start, value: "first@example.com" },
      {
        addedAt: new Date(start.getTime() + 60_000),
        value: "held1@example.com",
      },
      { addedAt: clock.now, value: "added@example.com" },
    ]);
  });
});
