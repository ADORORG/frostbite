import {
  authSessions,
  authUsers,
  contactIdentities,
  createDatabaseClient,
  createDatabasePool,
  platformRoleAssignments,
  walletIdentities,
} from "@ador/database";
import {
  createAuthorizationService,
  createDrizzleAuthorizationRepository,
} from "@ador/authorization";
import {
  createAuthMethods,
  createHeldMethodKinds,
} from "@ador/feature-accounts/methods";
import { authorizationPolicy } from "@repo/config/authorization";
import { uuidV7Schema, type UuidV7 } from "@ador/shared/identifiers";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { withDisposablePostgres } from "../../../packages/database/test/support/postgres-container.ts";
import { creatorE2EFixtures, seededEmails } from "../src/creator-fixtures.ts";
import { seedAdministration, seedOnce } from "../scripts/stack-setup.ts";

const { admin, roleCandidate } = creatorE2EFixtures;
const pool = (url: string) =>
  createDatabasePool({
    DATABASE_ACQUIRE_TIMEOUT_MS: 5_000,
    DATABASE_IDLE_TIMEOUT_MS: 1_000,
    DATABASE_POOL_MAX: 2,
    DATABASE_SSL_MODE: "disable",
    DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
    DATABASE_URL: url,
  });

// What the platform itself decides for a seeded person: the real authorization service over the real method registry.
function authorization(database: ReturnType<typeof createDatabaseClient>) {
  return createAuthorizationService({
    policy: authorizationPolicy,
    repository: createDrizzleAuthorizationRepository(
      database,
      createHeldMethodKinds(createAuthMethods({ email: true })),
    ),
  });
}

const mayManageRoles = async (
  service: ReturnType<typeof authorization>,
  userId: UuidV7,
) =>
  (await service.forPlatform({ capability: "platform:manage-roles", userId }))
    .allowed;

describe("the seeded administrator", () => {
  it("is an administrator whose role works, the person to give a role to has none, and both can be found by email", async () => {
    await withDisposablePostgres(async (url) => {
      expect(await seedOnce(url)).toBe("seeded");
      const connection = pool(url);
      try {
        const database = createDatabaseClient(connection);
        const service = authorization(database);
        expect(
          await mayManageRoles(service, uuidV7Schema.parse(admin.userId)),
        ).toBe(true);
        expect(
          await mayManageRoles(
            service,
            uuidV7Schema.parse(roleCandidate.userId),
          ),
        ).toBe(false);
        const emails = await database
          .select({
            userId: contactIdentities.userId,
            value: contactIdentities.value,
          })
          .from(contactIdentities)
          .where(
            inArray(contactIdentities.userId, [
              admin.userId,
              roleCandidate.userId,
            ]),
          );
        expect(emails.sort((a, b) => a.value.localeCompare(b.value))).toEqual([
          { userId: admin.userId, value: seededEmails.admin },
          { userId: roleCandidate.userId, value: seededEmails.roleCandidate },
        ]);
        const wallets = await database
          .select({ userId: walletIdentities.userId })
          .from(walletIdentities)
          .where(
            inArray(walletIdentities.userId, [
              admin.userId,
              roleCandidate.userId,
            ]),
          );
        // Only the administrator has a wallet; that is what makes the candidate's role "not working yet".
        expect(wallets).toEqual([{ userId: admin.userId }]);
      } finally {
        await connection.end();
      }
    });
  });

  it("is added to a stack that kept its data from before it existed, and adding twice changes nothing", async () => {
    await withDisposablePostgres(async (url) => {
      await seedOnce(url);
      const connection = pool(url);
      try {
        const database = createDatabaseClient(connection);
        await database
          .delete(platformRoleAssignments)
          .where(eq(platformRoleAssignments.userId, admin.userId));
        await database
          .delete(authSessions)
          .where(
            inArray(authSessions.userId, [admin.userId, roleCandidate.userId]),
          );
        await database
          .delete(authUsers)
          .where(inArray(authUsers.id, [admin.userId, roleCandidate.userId]));
        expect(await seedOnce(url)).toBe("kept");
        expect(
          await mayManageRoles(
            authorization(database),
            uuidV7Schema.parse(admin.userId),
          ),
        ).toBe(true);
        await seedAdministration(database);
        expect(
          await database
            .select()
            .from(platformRoleAssignments)
            .where(eq(platformRoleAssignments.userId, admin.userId)),
        ).toHaveLength(1);
      } finally {
        await connection.end();
      }
    });
  });
});
