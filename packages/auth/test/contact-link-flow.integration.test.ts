import { authSessions } from "@ador/database";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import { world } from "./support/contact-flow-world.ts";
import {
  clock,
  database,
  signedInAccount,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

// The addresses an account holds, as text, oldest first.
async function addressesOf(
  links: Awaited<ReturnType<typeof world>>["links"],
  userId: string,
) {
  return (await links.addresses(userId, "email")).addresses.map(
    ({ value }) => value,
  );
}

describe("linking a second address to a signed-in account", () => {
  async function activeSession(userId: string) {
    const sessions = await database.select().from(authSessions);
    const session = sessions.find(
      (row) => row.userId === userId && row.revokedAt === null,
    );
    if (session === undefined) throw new Error("no live session");
    return {
      absoluteExpiresAt: session.absoluteExpiresAt,
      authenticatedAt: session.authenticatedAt,
      idleExpiresAt: session.idleExpiresAt,
      sessionId: uuidV7Schema.parse(session.id),
      userId: uuidV7Schema.parse(userId),
    };
  }
  const address = "second@example.com";
  const correlationId = createUuidV7();

  it("proves the mailbox with a code, adds the address, and then signing in with either address opens the same account", async () => {
    const { codeSentTo, links, service } = await world();
    const account = await signedInAccount({ address: "first@example.com" });
    const session = await activeSession(account.userId);
    expect(
      await links.request({ destination: address, kind: "email", session }),
    ).toEqual({ ok: true });
    const code = await codeSentTo(address);
    const linked = await links.confirm({
      code,
      correlationId,
      destination: address,
      kind: "email",
      session,
    });
    expect(linked.ok && linked.sessionToken !== null).toBe(true);
    expect(await addressesOf(links, account.userId)).toEqual([
      "first@example.com",
      "second@example.com",
    ]);
    clock.now = new Date(start.getTime() + 120_000);
    await service.request({ destination: address, kind: "email" });
    const signedIn = await service.verify({
      code: await codeSentTo(address),
      destination: address,
      kind: "email",
    });
    expect(signedIn.ok).toBe(true);
    const [row] = (await database.select().from(authSessions)).filter(
      ({ revokedAt, tokenHash }) =>
        revokedAt === null &&
        signedIn.ok &&
        tokenHash === sha256(signedIn.sessionToken),
    );
    expect(row?.userId).toBe(account.userId);
  });

  it("does not let a sign-in code link, or a link code sign in", async () => {
    const { codeSentTo, links, service } = await world();
    const account = await signedInAccount({ address: "first@example.com" });
    const session = await activeSession(account.userId);
    await service.request({ destination: address, kind: "email" });
    const signInCode = await codeSentTo(address);
    expect(
      await links.confirm({
        code: signInCode,
        correlationId,
        destination: address,
        kind: "email",
        session,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    clock.now = new Date(start.getTime() + 120_000);
    await links.request({ destination: address, kind: "email", session });
    expect(
      await service.verify({
        code: await codeSentTo(address),
        destination: address,
        kind: "email",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an address another account holds, only after the mailbox is proven", async () => {
    const { codeSentTo, links } = await world();
    await signedInAccount({ address });
    const account = await signedInAccount({ address: "first@example.com" });
    const session = await activeSession(account.userId);
    expect(
      await links.request({ destination: address, kind: "email", session }),
    ).toEqual({ ok: true });
    expect(
      await links.confirm({
        code: await codeSentTo(address),
        correlationId,
        destination: address,
        kind: "email",
        session,
      }),
    ).toEqual({ ok: false, reason: "taken" });
    expect(await addressesOf(links, account.userId)).toEqual([
      "first@example.com",
    ]);
  });
});
