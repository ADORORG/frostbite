import { randomBytes } from "node:crypto";

import {
  platformSetupLinks,
  runMigrations,
  walletIdentities,
} from "@ador/database";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleSetupLinks } from "../src/adapters/drizzle-setup-link.ts";
import { lockRoleChanges } from "../src/adapters/role-assignment.ts";
import { createSetupLinkService } from "../src/application/setup-link.ts";
import {
  hashSetupToken,
  isSetupTokenShaped,
} from "../src/application/setup-token.ts";
import {
  addWallet,
  admin,
  clean,
  database,
  environment,
  eventsFor,
  lookup,
  person,
  pool,
  rules,
  status,
} from "./support/role-world.ts";

const hour = 3_600_000;
const clock = { now: new Date("2026-10-25T10:00:00.000Z") };
const links = createSetupLinkService({
  clock: () => clock.now,
  policy: { lifetimeMs: hour, policyVersion: "test-v2" },
  randomBytes: (length) => randomBytes(length),
  repository: createDrizzleSetupLinks(database, rules),
});

async function mint(): Promise<string> {
  const result = await links.mint();
  if (result.kind !== "minted") throw new Error("expected a link");
  return result.token;
}
const redeem = (token: string, userId: UuidV7) =>
  links.redeem({ correlationId: createUuidV7(), token, userId });
const rows = () => database.select().from(platformSetupLinks);

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  clock.now = new Date("2026-10-25T10:00:00.000Z");
  await clean();
});
afterAll(async () => {
  await clean();
  await pool.end();
});

describe("minting a setup link", () => {
  it("keeps only the hash of the token, valid for the policy's lifetime", async () => {
    const token = await mint();
    const [row] = await rows();
    expect(row?.tokenHash).toBe(hashSetupToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row?.expiresAt.getTime()).toBe(clock.now.getTime() + hour);
    expect(row?.consumedAt).toBeNull();
    expect(row?.revokedAt).toBeNull();
  });

  it("replaces the earlier link: only the newest one works", async () => {
    const older = await mint();
    const newer = await mint();
    const user = await person(true);
    expect(await redeem(older, user)).toEqual({ kind: "invalid-link" });
    expect(await status(user, "admin")).toBeNull();
    expect(await redeem(newer, user)).toEqual({ kind: "granted" });
  });

  it("waits for any role change in progress, so two operators minting together cannot leave two working links", async () => {
    let release = () => {};
    const held = database.transaction(async (transaction) => {
      await lockRoleChanges(transaction);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    let finished = false;
    const minting = mint().then((token) => {
      finished = true;
      return token;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(finished).toBe(false);
    expect(await rows()).toHaveLength(0);
    release();
    await held;
    expect(isSetupTokenShaped(await minting)).toBe(true);
    expect(await rows()).toHaveLength(1);
  });

  it("is refused while a working administrator exists, and writes nothing", async () => {
    await admin();
    expect(await links.mint()).toEqual({ kind: "admin-exists" });
    expect(await rows()).toHaveLength(0);
  });

  it("is allowed while the only administrator has no wallet, because that role does not work", async () => {
    await admin(false);
    expect((await links.mint()).kind).toBe("minted");
  });
});

describe("redeeming a setup link", () => {
  it("makes the person an administrator, records them as the actor via the setup link, and spends the link", async () => {
    const token = await mint();
    const user = await person(true);
    expect(await redeem(token, user)).toEqual({ kind: "granted" });
    expect(await status(user, "admin")).toBe("active");
    const [event] = await eventsFor(user);
    expect(event).toMatchObject({
      action: "granted",
      actorUserId: user,
      nextStatus: "active",
      policyVersion: "test-v2",
      role: "admin",
      via: "setup-link",
    });
    const [row] = await rows();
    expect(row?.consumedByUserId).toBe(user);
    expect(row?.consumedAt).toEqual(clock.now);
  });

  it("answers a retry by the same person without a second grant or second piece of evidence", async () => {
    const token = await mint();
    const user = await person(true);
    await redeem(token, user);
    expect(await redeem(token, user)).toEqual({ kind: "already-used-by-you" });
    expect(await eventsFor(user)).toHaveLength(1);
  });

  it("does not work for anyone else once spent", async () => {
    const token = await mint();
    await redeem(token, await person(true));
    const other = await person(true);
    expect(await redeem(token, other)).toEqual({ kind: "invalid-link" });
    expect(await status(other, "admin")).toBeNull();
  });

  it("stays spent for everyone else even after the first administrator stops working, so the spent mark itself is what refuses", async () => {
    const token = await mint();
    const first = await person(true);
    await redeem(token, first);
    await database.delete(walletIdentities);
    const other = await person(true);
    expect(await redeem(token, other)).toEqual({ kind: "invalid-link" });
    expect(await status(other, "admin")).toBeNull();
  });

  it("gives the same answer for a link that never existed, one that expired, and one that was replaced", async () => {
    const user = await person(true);
    const unknown = "A".repeat(43);
    expect(await redeem(unknown, user)).toEqual({ kind: "invalid-link" });
    const token = await mint();
    clock.now = new Date(clock.now.getTime() + hour);
    expect(await redeem(token, user)).toEqual({ kind: "invalid-link" });
    expect(await status(user, "admin")).toBeNull();
  });

  it("still works one millisecond before it expires", async () => {
    const token = await mint();
    clock.now = new Date(clock.now.getTime() + hour - 1);
    expect(await redeem(token, await person(true))).toEqual({
      kind: "granted",
    });
  });

  it("asks for the missing sign-in method, leaves the link unspent, and works once the method is added", async () => {
    const token = await mint();
    const user = await person(false);
    expect(await redeem(token, user)).toEqual({
      kind: "needs-method",
      missing: ["wallet"],
    });
    expect(await status(user, "admin")).toBeNull();
    expect((await rows())[0]?.consumedAt).toBeNull();
    await addWallet(user);
    expect(await redeem(token, user)).toEqual({ kind: "granted" });
  });

  it("is refused when a working administrator appeared after the link was minted, and the link stays unspent", async () => {
    const token = await mint();
    await admin();
    const user = await person(true);
    expect(await redeem(token, user)).toEqual({ kind: "invalid-link" });
    expect(await status(user, "admin")).toBeNull();
    expect((await rows())[0]?.consumedAt).toBeNull();
  });

  it("makes exactly one of two people opening the same link administrator, even when they arrive together", async () => {
    const token = await mint();
    const a = await person(true);
    const b = await person(true);
    lookup.delayMs = 40;
    const results = await Promise.all([
      redeem(token, a),
      redeem(token, b),
    ]).finally(() => {
      lookup.delayMs = 0;
    });
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "granted",
      "invalid-link",
    ]);
    const holders = [await status(a, "admin"), await status(b, "admin")];
    expect(holders.filter((value) => value === "active")).toHaveLength(1);
    const [row] = await database
      .select()
      .from(platformSetupLinks)
      .where(eq(platformSetupLinks.tokenHash, hashSetupToken(token)));
    expect([a, b]).toContain(row?.consumedByUserId);
  });
});

describe("the table's own checks", () => {
  const insert = (values: Partial<typeof platformSetupLinks.$inferInsert>) =>
    database.insert(platformSetupLinks).values({
      // Both times come from the test's clock; a creation time left to the database would be the real one, which is past the fixed expiry.
      createdAt: clock.now,
      expiresAt: new Date(clock.now.getTime() + hour),
      id: createUuidV7(),
      tokenHash: "a".repeat(64),
      ...values,
    });

  it("refuses a stored value that is not a SHA-256 hex digest", async () => {
    await expect(insert({ tokenHash: "plain-token" })).rejects.toThrow();
  });

  it("refuses an expiry that is not after the creation", async () => {
    await expect(
      insert({ createdAt: clock.now, expiresAt: clock.now }),
    ).rejects.toThrow();
  });

  it("refuses a consumption time without a consumer", async () => {
    await expect(insert({ consumedAt: clock.now })).rejects.toThrow();
  });

  it("refuses the same hash twice", async () => {
    await insert({});
    await expect(insert({})).rejects.toThrow();
  });
});
