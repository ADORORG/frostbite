import { authSessions, contactCodes } from "@ador/database";
import type { MailSender } from "@ador/mail";
import { describe, expect, it } from "vitest";

import { emailMethod } from "../src/contacts/method.ts";
import { createMethodRegistry } from "../src/methods/registry.ts";
import { sha256 } from "../src/domain/crypto.ts";
import { passkeyMethod } from "../src/passkeys/method.ts";
import { walletMethod } from "../src/wallets/method.ts";
import { policy, world } from "./support/contact-flow-world.ts";
import {
  clock,
  database,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

const ada = { destination: "Ada@Example.com", kind: "email" } as const;
const wrongOf = (code: string) => (code === "000000" ? "111111" : "000000");

describe("signing in with an emailed code", () => {
  it("sends a code to the normalized address and signs the person in with it, once", async () => {
    const { codeSentTo, service } = await world();
    expect(await service.request(ada)).toEqual({ ok: true });
    const code = await codeSentTo("ada@example.com");
    const signedIn = await service.verify({ ...ada, code });
    if (!signedIn.ok) throw new Error("expected a sign-in");
    const [session] = await database.select().from(authSessions);
    expect(session?.tokenHash).toBe(sha256(signedIn.sessionToken));
    expect(await service.verify({ ...ada, code })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("keeps only a hash: the code is in the mail and nowhere in the database", async () => {
    const { codeSentTo, service } = await world();
    await service.request(ada);
    const code = await codeSentTo("ada@example.com");
    const [row] = await database.select().from(contactCodes);
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it("dies after five wrong tries, even for the right code", async () => {
    const { codeSentTo, service } = await world();
    await service.request(ada);
    const code = await codeSentTo("ada@example.com");
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect(await service.verify({ ...ada, code: wrongOf(code) })).toEqual({
        ok: false,
        reason: "invalid",
      });
    expect(await service.verify({ ...ada, code })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("works on the fifth try, and not after the code has expired", async () => {
    const { codeSentTo, service } = await world();
    await service.request(ada);
    const code = await codeSentTo("ada@example.com");
    for (let attempt = 0; attempt < 4; attempt += 1)
      await service.verify({ ...ada, code: wrongOf(code) });
    clock.now = new Date(start.getTime() + policy.lifetimeMs);
    expect(await service.verify({ ...ada, code })).toEqual({
      ok: false,
      reason: "invalid",
    });
    clock.now = start;
    expect((await service.verify({ ...ada, code })).ok).toBe(true);
  });

  it("makes the earlier code useless when a new one is asked for", async () => {
    const { codeSentTo, service } = await world();
    await service.request(ada);
    const first = await codeSentTo("ada@example.com");
    clock.now = new Date(start.getTime() + policy.resendCooldownMs);
    await service.request(ada);
    expect(await service.verify({ ...ada, code: first })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("makes a person wait between sends, and says how long", async () => {
    const { service } = await world();
    await service.request(ada);
    expect(await service.request(ada)).toEqual({
      ok: false,
      reason: "cooldown",
      retryAfterMs: policy.resendCooldownMs,
    });
  });

  it("answers a new address and a known one alike", async () => {
    const { codeSentTo, service } = await world();
    await service.request(ada);
    await service.verify({ ...ada, code: await codeSentTo("ada@example.com") });
    clock.now = new Date(start.getTime() + 120_000);
    const known = await service.request(ada);
    const fresh = await service.request({
      destination: "grace@example.com",
      kind: "email",
    });
    expect(known).toEqual(fresh);
  });

  it("counts a failed send for nothing: the person may ask again at once", async () => {
    let fail = true;
    const flaky: MailSender = {
      send: () =>
        fail ? Promise.reject(new Error("down")) : Promise.resolve(),
    };
    const { service } = await world(flaky);
    expect(await service.request(ada)).toEqual({
      ok: false,
      reason: "delivery-failed",
    });
    expect(await database.select().from(contactCodes)).toHaveLength(0);
    fail = false;
    expect(await service.request(ada)).toEqual({ ok: true });
  });
});

describe("the email method", () => {
  it("lists the addresses an account has, and counts as a way in", async () => {
    const { codeSentTo, service } = await world();
    await service.request(ada);
    await service.verify({ ...ada, code: await codeSentTo("ada@example.com") });
    const registry = createMethodRegistry([
      walletMethod,
      passkeyMethod,
      emailMethod,
    ]);
    const [session] = await database.select().from(authSessions);
    if (session === undefined) throw new Error("expected a session");
    const listed = await database.transaction((transaction) =>
      registry.list(transaction, session.userId),
    );
    expect(listed).toEqual([
      {
        assurance: "standard",
        canSignIn: true,
        id: "ada@example.com",
        kind: "email",
      },
    ]);
  });
});
