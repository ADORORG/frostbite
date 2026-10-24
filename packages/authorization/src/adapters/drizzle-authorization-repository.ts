import {
  organizationMemberships,
  organizations,
  platformRoleAssignments,
} from "@ador/database/schema/accounts";
import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import {
  accountStatusSchema,
  organizationRoleSchema,
  platformRoleSchema,
  type MethodKind,
} from "@ador/shared/accounts";
import { and, eq } from "drizzle-orm";

import type { AuthorizationRepository } from "../application/repository.ts";

// The kinds of sign-in method an account holds, read in the caller's transaction. Supplied by the composition root from the sign-in
// method registry, so this package knows no method.
export type HeldKinds = (
  context: DatabaseTransaction,
  userId: string,
) => Promise<ReadonlySet<MethodKind>>;

export function createDrizzleAuthorizationRepository(
  database: DatabaseClient,
  heldKinds: HeldKinds,
): AuthorizationRepository {
  return {
    async findOrganizationAccess(userId, organizationId) {
      const [record] = await database
        .select({
          membershipStatus: organizationMemberships.status,
          organizationStatus: organizations.status,
          role: organizationMemberships.role,
        })
        .from(organizationMemberships)
        .innerJoin(
          organizations,
          eq(organizationMemberships.organizationId, organizations.id),
        )
        .where(
          and(
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (record === undefined) return null;
      return {
        membershipStatus: accountStatusSchema.parse(record.membershipStatus),
        organizationStatus: accountStatusSchema.parse(
          record.organizationStatus,
        ),
        role: organizationRoleSchema.parse(record.role),
      };
    },

    findHeldMethodKinds: (userId) =>
      database.transaction((transaction) => heldKinds(transaction, userId)),

    async findPlatformRoles(userId) {
      const records = await database
        .select({ role: platformRoleAssignments.role })
        .from(platformRoleAssignments)
        .where(
          and(
            eq(platformRoleAssignments.userId, userId),
            eq(platformRoleAssignments.status, "active"),
          ),
        );
      return records.map((record) => platformRoleSchema.parse(record.role));
    },
  };
}
