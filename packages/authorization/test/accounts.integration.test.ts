import {
  accountAuditEvents,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  organizationMemberships,
  organizations,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  runMigrations,
} from "@frostbite/database";
import type { AuthorizationPolicy } from "@frostbite/shared/accounts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleAccountRepository } from "../src/adapters/drizzle-account-repository.ts";
import { createDrizzleAuthorizationRepository } from "../src/adapters/drizzle-authorization-repository.ts";
import { createAccountService } from "../src/application/account-service.ts";
import { createAuthorizationService } from "../src/application/service.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const policy: AuthorizationPolicy = {
  organization: {
    admin: ["organization:members"],
    analyst: ["organization:read"],
    editor: ["organization:edit"],
    owner: ["organization:members", "organization:ownership"],
  },
  platform: {
    admin: [],
    reviewer: ["creator:review"],
    staff: ["platform:operate"],
  },
  requiredMethods: {},
  version: "test-v1",
};
const accounts = createAccountService({
  clock: () => new Date("2026-09-09T02:00:00.000Z"),
  membershipCapability: "organization:members",
  policy,
  repository: createDrizzleAccountRepository(database),
});
const authorization = createAuthorizationService({
  policy,
  repository: createDrizzleAuthorizationRepository(
    database,
    async () => new Set(),
  ),
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(accountAuditEvents);
  await database.delete(platformRoleAssignments);
  await database.delete(organizationMemberships);
  await database.delete(organizations);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

async function user(name: string) {
  const id = createUuidV7();
  await database.insert(authUsers).values({
    email: `${id}@wallet.invalid`,
    id,
    name,
  });
  return id;
}

async function organization(ownerId: Awaited<ReturnType<typeof user>>) {
  const result = await accounts.createOrganization({
    actorUserId: ownerId,
    correlationId: createUuidV7(),
    name: "Test organization",
  });
  if (result === null) throw new Error("Expected organization");
  return result.organizationId;
}

describe("account persistence and authorization", () => {
  it("creates an organization, owner, and audit event atomically", async () => {
    const ownerId = await user("Owner");
    const organizationId = await organization(ownerId);
    await expect(database.select().from(organizations)).resolves.toHaveLength(
      1,
    );
    await expect(
      database.select().from(organizationMemberships),
    ).resolves.toMatchObject([
      { organizationId, role: "owner", status: "active", userId: ownerId },
    ]);
    await expect(
      database.select().from(accountAuditEvents),
    ).resolves.toMatchObject([
      {
        action: "organization-created",
        actorUserId: ownerId,
        organizationId,
        targetUserId: ownerId,
      },
    ]);
  });

  it("rolls back organization creation when the owner does not exist", async () => {
    await expect(
      accounts.createOrganization({
        actorUserId: createUuidV7(),
        correlationId: createUuidV7(),
        name: "No owner",
      }),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    await expect(database.select().from(organizations)).resolves.toHaveLength(
      0,
    );
    await expect(
      database.select().from(accountAuditEvents),
    ).resolves.toHaveLength(0);
  });

  it("denies cross-organization actors and suspended organizations", async () => {
    const ownerId = await user("Owner");
    const outsiderId = await user("Outsider");
    const targetId = await user("Target");
    const organizationId = await organization(ownerId);
    await expect(
      accounts.changeMembership({
        actorUserId: outsiderId,
        correlationId: createUuidV7(),
        nextRole: "editor",
        nextStatus: "active",
        ownershipStepUpVerified: false,
        organizationId,
        reasonCode: "add-editor",
        targetUserId: targetId,
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    await database
      .update(organizations)
      .set({ status: "suspended" })
      .where(eq(organizations.id, organizationId));
    await expect(
      authorization.forOrganization({
        capability: "organization:members",
        organizationId,
        userId: ownerId,
      }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
    await expect(
      accounts.changeMembership({
        actorUserId: ownerId,
        correlationId: createUuidV7(),
        nextRole: "analyst",
        nextStatus: "active",
        organizationId,
        ownershipStepUpVerified: false,
        reasonCode: "add-analyst",
        targetUserId: targetId,
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    await expect(
      accounts.changeMembership({
        actorUserId: ownerId,
        correlationId: createUuidV7(),
        nextRole: "analyst",
        nextStatus: "active",
        organizationId: createUuidV7(),
        ownershipStepUpVerified: false,
        reasonCode: "add-analyst",
        targetUserId: targetId,
      }),
    ).resolves.toEqual({ kind: "not-found" });
  });

  it("serializes concurrent owner demotions and preserves one active owner", async () => {
    const firstOwner = await user("First");
    const secondOwner = await user("Second");
    const organizationId = await organization(firstOwner);
    await expect(
      accounts.changeMembership({
        actorUserId: firstOwner,
        correlationId: createUuidV7(),
        nextRole: "owner",
        nextStatus: "active",
        organizationId,
        ownershipStepUpVerified: false,
        reasonCode: "add-owner",
        targetUserId: secondOwner,
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    await accounts.changeMembership({
      actorUserId: firstOwner,
      correlationId: createUuidV7(),
      nextRole: "owner",
      nextStatus: "active",
      ownershipStepUpVerified: true,
      organizationId,
      reasonCode: "add-owner",
      targetUserId: secondOwner,
    });
    const demote = (
      actorUserId: typeof firstOwner,
      targetUserId: typeof firstOwner,
    ) =>
      accounts.changeMembership({
        actorUserId,
        correlationId: createUuidV7(),
        nextRole: "admin",
        nextStatus: "active",
        ownershipStepUpVerified: true,
        organizationId,
        reasonCode: "owner-transfer",
        targetUserId,
      });
    const results = await Promise.all([
      demote(firstOwner, firstOwner),
      demote(secondOwner, secondOwner),
    ]);
    expect(results).toEqual(
      expect.arrayContaining([{ kind: "changed" }, { kind: "last-owner" }]),
    );
    const memberships = await database.select().from(organizationMemberships);
    expect(
      memberships.filter(
        (membership) =>
          membership.role === "owner" && membership.status === "active",
      ),
    ).toHaveLength(1);
    expect(
      (await database.select().from(accountAuditEvents)).filter(
        (event) => event.reasonCode === "owner-transfer",
      ),
    ).toHaveLength(1);
  });

  it("keeps active platform roles independent from organization access", async () => {
    const reviewerId = await user("Reviewer");
    await database.insert(platformRoleAssignments).values({
      id: createUuidV7(),
      role: "reviewer",
      status: "active",
      userId: reviewerId,
    });
    await expect(
      authorization.forPlatform({
        capability: "creator:review",
        userId: reviewerId,
      }),
    ).resolves.toEqual({ allowed: true, policyVersion: "test-v1" });
    await database
      .update(platformRoleAssignments)
      .set({ status: "suspended" })
      .where(eq(platformRoleAssignments.userId, reviewerId));
    await expect(
      authorization.forPlatform({
        capability: "creator:review",
        userId: reviewerId,
      }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
  });
});
