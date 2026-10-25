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
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { mintSetupLink } from "../src/link.ts";
import { createSetupLinkServiceFor } from "../src/services.ts";

// The command's own wiring against a real database: the service it builds is the platform's (the sign-in method registry reads the
// real wallet tables), and the link it prints opens.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const service = createSetupLinkServiceFor(database);
const baseUrl = "https://launch.example.com";
const created: UuidV7[] = [];

async function person(withWallet: boolean): Promise<UuidV7> {
  const id = createUuidV7();
  created.push(id);
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
function tokenIn(url: string): string {
  return new URL(url).hash.slice(1);
}

async function clean() {
  await database.delete(platformSetupLinks);
  if (created.length > 0) {
    await database
      .delete(platformRoleEvents)
      .where(inArray(platformRoleEvents.targetUserId, created));
    await database
      .delete(platformRoleAssignments)
      .where(inArray(platformRoleAssignments.userId, created));
    await database
      .delete(walletIdentities)
      .where(inArray(walletIdentities.userId, created));
    await database.delete(authUsers).where(inArray(authUsers.id, created));
    created.length = 0;
  }
}

beforeAll(async () => runMigrations(environment));
beforeEach(clean);
afterAll(async () => {
  await clean();
  await pool.end();
});

describe("the operator's setup link", () => {
  it("opens for a person with a wallet, who becomes the administrator, and it cannot be used again", async () => {
    const report = await mintSetupLink({ baseUrl, service });
    if (report.kind !== "minted") throw new Error("expected a link");
    const token = tokenIn(report.url);
    const user = await person(true);
    const request = { correlationId: createUuidV7(), token, userId: user };
    expect(await service.redeem(request)).toEqual({ kind: "granted" });
    // Setup is over: no new link, and the spent one is no use to anybody else.
    expect(await mintSetupLink({ baseUrl, service })).toEqual({
      kind: "admin-exists",
    });
    expect(
      await service.redeem({ ...request, userId: await person(true) }),
    ).toEqual({ kind: "invalid-link" });
  });

  it("asks for a wallet when the person signing in has none, using the platform's own policy", async () => {
    const report = await mintSetupLink({ baseUrl, service });
    if (report.kind !== "minted") throw new Error("expected a link");
    expect(
      await service.redeem({
        correlationId: createUuidV7(),
        token: tokenIn(report.url),
        userId: await person(false),
      }),
    ).toEqual({ kind: "needs-method", missing: ["wallet"] });
  });

  it("makes a link that expires an hour on, as the platform's policy says", async () => {
    const before = Date.now();
    const report = await mintSetupLink({ baseUrl, service });
    if (report.kind !== "minted") throw new Error("expected a link");
    expect(report.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      3_600_000 - 1_000,
    );
    expect(report.expiresAt.getTime() - before).toBeLessThanOrEqual(
      3_600_000 + 5_000,
    );
  });
});
