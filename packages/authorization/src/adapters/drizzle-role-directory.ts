import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import { platformRoleAssignments } from "@ador/database/schema/accounts";
import { authUsers } from "@ador/database/schema/auth";
import { platformRoleSchema } from "@ador/shared/accounts";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { asc, eq, inArray } from "drizzle-orm";

import { effectiveRoles } from "../application/effective-roles.ts";
import type {
  DirectoryEntry,
  RoleDirectoryRepository,
} from "../application/role-directory.ts";
import type { RoleRules } from "./role-assignment.ts";

// Naming and finding accounts is the sign-in methods' business, so it is given, from the method registry: this package knows no method.
export interface DirectoryRules extends RoleRules {
  readonly label: (
    transaction: DatabaseTransaction,
    userId: string,
  ) => Promise<string | null>;
  readonly lookup: (
    transaction: DatabaseTransaction,
    text: string,
  ) => Promise<readonly string[]>;
}

const HOLDERS_LIMIT = 200;

async function entriesFor(
  transaction: DatabaseTransaction,
  userIds: readonly string[],
  rules: DirectoryRules,
): Promise<readonly DirectoryEntry[]> {
  if (userIds.length === 0) return [];
  const assignments = await transaction
    .select()
    .from(platformRoleAssignments)
    .where(inArray(platformRoleAssignments.userId, [...userIds]))
    .orderBy(asc(platformRoleAssignments.role));
  const entries: DirectoryEntry[] = [];
  for (const userId of userIds) {
    const mine = assignments.filter((row) => row.userId === userId);
    const held = await rules.heldKinds(transaction, userId);
    const working = effectiveRoles(
      mine
        .filter(({ status }) => status === "active")
        .map(({ role }) => platformRoleSchema.parse(role)),
      held,
      rules.requiredMethods,
    );
    entries.push({
      label:
        (await rules.label(transaction, userId)) ??
        `Account ${userId.slice(0, 8)}`,
      roles: mine.map((row) => {
        const role = platformRoleSchema.parse(row.role);
        return {
          effective: working.includes(role),
          role,
          status: row.status,
        };
      }),
      userId,
    });
  }
  return entries;
}

export function createDrizzleRoleDirectory(
  database: DatabaseClient,
  rules: DirectoryRules,
): RoleDirectoryRepository {
  return {
    holders: () =>
      database.transaction(async (transaction) => {
        const rows = await transaction
          .selectDistinct({ userId: platformRoleAssignments.userId })
          .from(platformRoleAssignments)
          .orderBy(asc(platformRoleAssignments.userId))
          .limit(HOLDERS_LIMIT);
        return entriesFor(
          transaction,
          rows.map(({ userId }) => userId),
          rules,
        );
      }),

    find: (text, limit) =>
      database.transaction(async (transaction) => {
        const named = await rules.lookup(transaction, text);
        // An account id typed as it is (a way to name someone who has no readable method, or to be sure).
        const typedId = uuidV7Schema.safeParse(text);
        const byId = typedId.success
          ? await transaction
              .select({ id: authUsers.id })
              .from(authUsers)
              .where(eq(authUsers.id, typedId.data))
          : [];
        const ids = [...new Set([...named, ...byId.map(({ id }) => id)])].slice(
          0,
          limit,
        );
        return entriesFor(transaction, ids, rules);
      }),
  };
}
