import {
  authSecurityEvents,
  authSessions,
  contactIdentities,
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import {
  change,
  identities,
  links,
  window,
} from "./support/contact-link-world.ts";
import {
  database,
  signedInAccount,
  signedInAccountSession,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

describe("removing an address", () => {
  async function twoAddresses() {
    const account = await signedInAccount({ address: "keep@example.com" });
    await database.insert(contactIdentities).values({
      id: createUuidV7(),
      kind: "email",
      userId: account.userId,
      value: "drop@example.com",
      verifiedAt: start,
    });
    return account;
  }

  it("removes it, signs every session out, starts the new one and records it", async () => {
    const account = await twoAddresses();
    const input = change(account, "drop@example.com");
    expect(await links.unlink(input)).toEqual({ kind: "unlinked" });
    expect((await identities()).map(({ value }) => value)).toEqual([
      "keep@example.com",
    ]);
    const live = (await database.select().from(authSessions)).filter(
      ({ revokedAt }) => revokedAt === null,
    );
    expect(live.map(({ tokenHash }) => tokenHash)).toEqual([
      input.replacementSession.tokenHash,
    ]);
    const [event] = await database.select().from(authSecurityEvents);
    expect(event).toMatchObject({
      action: "email-unlinked",
      actorUserId: account.userId,
    });
    expect(event?.credentialFingerprint).toBe(sha256("email:drop@example.com"));
  });

  it("never removes the last way in", async () => {
    const account = await signedInAccount({ address: "only@example.com" });
    expect(await links.unlink(change(account, "only@example.com"))).toEqual({
      kind: "final-method",
    });
    expect(await identities()).toHaveLength(1);
    expect(await database.select().from(authSecurityEvents)).toEqual([]);
  });

  it("says missing for an address the account does not hold, including one another account holds", async () => {
    const other = await signedInAccount({ address: "theirs@example.com" });
    const account = await twoAddresses();
    expect(await links.unlink(change(account, "nobody@example.com"))).toEqual({
      kind: "missing",
    });
    expect(await links.unlink(change(account, "theirs@example.com"))).toEqual({
      kind: "missing",
    });
    expect(
      (await identities()).find(({ value }) => value === "theirs@example.com")
        ?.userId,
    ).toBe(other.userId);
  });

  it("refuses from a session that is no longer recent", async () => {
    const account = await signedInAccount({
      address: "keep@example.com",
      authenticatedAt: new Date(start.getTime() - window - 1),
    });
    await database.insert(contactIdentities).values({
      id: createUuidV7(),
      kind: "email",
      userId: account.userId,
      value: "drop@example.com",
      verifiedAt: start,
    });
    expect(await links.unlink(change(account, "drop@example.com"))).toEqual({
      kind: "session-not-recent",
    });
    expect(await identities()).toHaveLength(2);
  });

  it("lists an account's addresses, oldest first, and only its own", async () => {
    const account = await twoAddresses();
    await signedInAccount({ address: "other@example.com" });
    expect(
      (await links.list(account.userId, "email")).map(({ value }) => value),
    ).toEqual(["keep@example.com", "drop@example.com"]);
    expect(await links.list(account.userId, "phone")).toEqual([]);
  });

  it("never lets two sessions of one account remove its last two ways in together", async () => {
    const account = await twoAddresses();
    // A second session of the same account, so the two changes do not share a session row to wait on.
    const second = await signedInAccountSession(account.userId);
    const results = await Promise.all([
      links.unlink(change(account, "keep@example.com")),
      links.unlink(
        change(
          { sessionId: second, userId: account.userId },
          "drop@example.com",
        ),
      ),
    ]);
    // One removal wins and signs every session out, so the other finds its session gone; neither can leave the account with nothing.
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "session-not-recent",
      "unlinked",
    ]);
    expect(await identities()).toHaveLength(1);
  });
});
