import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  platformRoleEvents,
  runMigrations,
  walletIdentities,
} from "@ador/database";
import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleRoleAdministration } from "../src/adapters/drizzle-role-administration.ts";
import { createRoleAdministration } from "../src/application/role-administration.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: { admin: ["platform:manage-roles"], reviewer: [], staff: [] },
  requiredMethods: { admin: ["wallet"], staff: ["wallet"] },
  version: "test-v2",
};
// How long the method lookup takes. The lookup runs inside the role change's transaction, so a pause here holds a change open long
// enough for a second one to start beside it: that is how the test makes a race happen every time instead of when the timing allows.
const lookup = { delayMs: 0 };
// A stand-in for the sign-in method registry: an account holds a wallet when it has a wallet identity.
const heldKinds = async (
  context: Parameters<Parameters<typeof database.transaction>[0]>[0],
  userId: string,
) => {
  if (lookup.delayMs > 0)
    await new Promise((resolve) => setTimeout(resolve, lookup.delayMs));
  return new Set(
    (
      await context
        .select({ id: walletIdentities.id })
        .from(walletIdentities)
        .where(eq(walletIdentities.userId, userId))
    ).length > 0
      ? ["wallet"]
      : [],
  );
};
const now = new Date("2026-10-24T12:00:00.000Z");
const roles = createRoleAdministration({
  clock: () => now,
  policy,
  repository: createDrizzleRoleAdministration(database, {
    heldKinds,
    requiredMethods: policy.requiredMethods,
  }),
});

async function person(withWallet: boolean): Promise<UuidV7> {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Person" });
  if (withWallet)
    await database.insert(walletIdentities).values({
      address: `tb1q${id.replaceAll("-", "").slice(0, 30)}`,
      id: createUuidV7(),
      network: "signet",
      scriptIdentity: `script-${id}`,
      userId: id,
      walletAdapter: "xverse",
    });
  return id;
}
async function admin(withWallet = true): Promise<UuidV7> {
  const id = await person(withWallet);
  await database
    .insert(platformRoleAssignments)
    .values({ id: createUuidV7(), role: "admin", userId: id });
  return id;
}
const change = (actor: UuidV7, target: UuidV7, role = "staff") => ({
  actorUserId: actor,
  correlationId: createUuidV7(),
  role,
  targetUserId: target,
});
const eventsFor = (target: UuidV7) =>
  database
    .select()
    .from(platformRoleEvents)
    .where(eq(platformRoleEvents.targetUserId, target));
const status = async (user: UuidV7, role: "admin" | "staff") =>
  (
    await database
      .select()
      .from(platformRoleAssignments)
      .where(
        and(
          eq(platformRoleAssignments.userId, user),
          eq(platformRoleAssignments.role, role),
        ),
      )
  )[0]?.status ?? null;

beforeAll(async () => runMigrations(environment));
async function clean() {
  await database.delete(platformRoleEvents);
  await database.delete(platformRoleAssignments);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
}
beforeEach(clean);
// The audit table refuses to lose evidence with a user, so the other test files' own cleanup would fail on what this one leaves.
afterAll(async () => {
  await clean();
  await pool.end();
});

describe("granting a platform role", () => {
  it("lets an administrator grant a role, records who did it, and says the role works once the person holds a wallet", async () => {
    const actor = await admin();
    const target = await person(true);
    expect(await roles.grant(change(actor, target))).toEqual({
      effective: true,
      kind: "granted",
    });
    expect(await status(target, "staff")).toBe("active");
    const [event] = await eventsFor(target);
    expect(event).toMatchObject({
      action: "granted",
      actorUserId: actor,
      nextStatus: "active",
      policyVersion: "test-v2",
      previousStatus: null,
      role: "staff",
      via: "role-screen",
    });
  });

  it("records a role for someone with no wallet but says it does not work yet", async () => {
    const actor = await admin();
    const target = await person(false);
    expect(await roles.grant(change(actor, target))).toEqual({
      effective: false,
      kind: "granted",
    });
  });

  it("does nothing, and writes no second piece of evidence, when asked again", async () => {
    const actor = await admin();
    const target = await person(true);
    await roles.grant(change(actor, target));
    expect(await roles.grant(change(actor, target))).toEqual({
      effective: true,
      kind: "unchanged",
    });
    expect(await eventsFor(target)).toHaveLength(1);
  });

  it("refuses someone who is not an administrator, and an administrator whose own role does not work for lack of a wallet", async () => {
    const target = await person(true);
    const nobody = await person(true);
    expect(await roles.grant(change(nobody, target))).toEqual({
      kind: "forbidden",
    });
    const noWallet = await admin(false);
    expect(await roles.grant(change(noWallet, target))).toEqual({
      kind: "forbidden",
    });
    expect(await status(target, "staff")).toBeNull();
    expect(await eventsFor(target)).toHaveLength(0);
  });

  it("refuses a person who does not exist and a role that is not one", async () => {
    const actor = await admin();
    expect(await roles.grant(change(actor, createUuidV7()))).toEqual({
      kind: "unknown-user",
    });
    const target = await person(true);
    expect(await roles.grant(change(actor, target, "owner"))).toEqual({
      kind: "invalid-role",
    });
  });
});

describe("suspending a platform role", () => {
  it("suspends, records it, does nothing when repeated, and reinstates on a new grant", async () => {
    const actor = await admin();
    const target = await person(true);
    await roles.grant(change(actor, target));
    expect(await roles.suspend(change(actor, target))).toEqual({
      kind: "suspended",
    });
    expect(await status(target, "staff")).toBe("suspended");
    expect(await roles.suspend(change(actor, target))).toEqual({
      kind: "unchanged",
    });
    expect(await roles.grant(change(actor, target))).toEqual({
      effective: true,
      kind: "reinstated",
    });
    expect(
      (await eventsFor(target)).map(({ action }) => action).sort(),
    ).toEqual(["granted", "reinstated", "suspended"]);
  });

  it("finds nothing to suspend for a role the person never had", async () => {
    const actor = await admin();
    const target = await person(true);
    expect(await roles.suspend(change(actor, target))).toEqual({
      kind: "unchanged",
    });
    expect(await eventsFor(target)).toHaveLength(0);
  });

  it("refuses someone who is not an administrator", async () => {
    const target = await person(true);
    expect(await roles.suspend(change(await person(true), target))).toEqual({
      kind: "forbidden",
    });
  });
});

describe("the last administrator", () => {
  it("cannot be suspended, even by themselves, so the role screen always has someone to use it", async () => {
    const only = await admin();
    expect(await roles.suspend(change(only, only, "admin"))).toEqual({
      kind: "last-admin",
    });
    expect(await status(only, "admin")).toBe("active");
  });

  it("can be suspended once another administrator works", async () => {
    const first = await admin();
    const second = await admin();
    expect(await roles.suspend(change(first, second, "admin"))).toEqual({
      kind: "suspended",
    });
    expect(await status(second, "admin")).toBe("suspended");
    // Now the first is the last one.
    expect(await roles.suspend(change(first, first, "admin"))).toEqual({
      kind: "last-admin",
    });
  });

  it("does not count an administrator whose role does not work for lack of a wallet", async () => {
    const working = await admin();
    await admin(false);
    expect(await roles.suspend(change(working, working, "admin"))).toEqual({
      kind: "last-admin",
    });
  });

  it("holds when two administrators try to remove each other at once: one succeeds, the other is refused", async () => {
    const a = await admin();
    const b = await admin();
    lookup.delayMs = 40;
    const results = await Promise.all([
      roles.suspend(change(a, b, "admin")),
      roles.suspend(change(b, a, "admin")),
    ]).finally(() => {
      lookup.delayMs = 0;
    });
    expect(results.map(({ kind }) => kind).sort()).toEqual(
      ["forbidden", "suspended"].sort(),
    );
    const active = [await status(a, "admin"), await status(b, "admin")].filter(
      (value) => value === "active",
    );
    expect(active).toHaveLength(1);
  });
});
