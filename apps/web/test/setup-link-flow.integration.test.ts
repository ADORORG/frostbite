import { randomBytes, randomUUID } from "node:crypto";

import {
  createDrizzleSetupLinks,
  createSetupLinkService,
} from "@ador/authorization";
import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  platformRoleEvents,
  platformSetupLinks,
  runMigrations,
  walletIdentities,
} from "@ador/database";
import { createHeldMethodKinds } from "@ador/feature-accounts";
import { createRedeemSetupLinkOperation } from "@ador/feature-accounts/setup-operation";
import { correlationIdSchema } from "@ador/shared/http";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authMethods } from "../../../configs/auth-methods";
import { authorizationPolicy } from "../../../configs/authorization";

// The setup link as the page drives it, against real PostgreSQL: the HTTP operation, the service and the platform's real sign-in
// method registry together (the framing around them, with its session and origin checks, is covered with the other auth routes).
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const service = createSetupLinkService({
  clock: () => new Date(),
  policy: { lifetimeMs: 3_600_000, policyVersion: authorizationPolicy.version },
  randomBytes: (length) => randomBytes(length),
  repository: createDrizzleSetupLinks(database, {
    heldKinds: createHeldMethodKinds(authMethods),
    requiredMethods: authorizationPolicy.requiredMethods,
  }),
});
const operation = createRedeemSetupLinkOperation(() => service);

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
const asUser = (userId: UuidV7) => {
  const now = new Date();
  return {
    actorSession: {
      absoluteExpiresAt: new Date(now.getTime() + 60_000),
      authenticatedAt: now,
      idleExpiresAt: new Date(now.getTime() + 30_000),
      sessionId: createUuidV7(),
      userId,
    },
    actorUserId: userId,
    correlationId: correlationIdSchema.parse(randomUUID()),
  };
};
async function mintToken(): Promise<string> {
  const minted = await service.mint();
  if (minted.kind !== "minted") throw new Error("expected a link");
  return minted.token;
}

async function clean() {
  await database.delete(platformSetupLinks);
  await database.delete(platformRoleEvents);
  await database.delete(platformRoleAssignments);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
}

beforeAll(async () => runMigrations(environment));
beforeEach(clean);
afterAll(async () => {
  await clean();
  await pool.end();
});

describe("opening a setup link", () => {
  it("makes a signed-in person with a wallet the administrator, tells a retry so, and refuses everyone else", async () => {
    const token = await mintToken();
    const user = await person(true);
    expect(await operation.execute({ token }, asUser(user))).toEqual({
      ok: true,
      value: { status: "granted" },
    });
    expect(await operation.execute({ token }, asUser(user))).toEqual({
      ok: true,
      value: { status: "already-used-by-you" },
    });
    expect(
      await operation.execute({ token }, asUser(await person(true))),
    ).toMatchObject({ error: "not_found", ok: false });
  });

  it("asks a person with no wallet to add one, without spending the link", async () => {
    const token = await mintToken();
    const user = await person(false);
    expect(await operation.execute({ token }, asUser(user))).toMatchObject({
      error: "conflict",
      message: expect.stringContaining("wallet"),
      ok: false,
    });
    const [link] = await database.select().from(platformSetupLinks);
    expect(link?.consumedAt).toBeNull();
  });

  it("refuses a token that is not a link without an error that says why", async () => {
    const user = await person(true);
    for (const token of ["x", "A".repeat(43)])
      expect(await operation.execute({ token }, asUser(user))).toMatchObject({
        error: "not_found",
        ok: false,
      });
  });
});
