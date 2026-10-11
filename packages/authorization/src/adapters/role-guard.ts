import type { DatabaseTransaction } from "@ador/database/connection";
import { platformRoleAssignments } from "@ador/database/schema/accounts";
import type { PlatformRole } from "@ador/shared/accounts";
import { and, eq, inArray } from "drizzle-orm";

// Whether the user holds an active assignment of one of the roles, read inside the caller's
// transaction with a shared lock on the assignment row. A reviewer's role cannot be withdrawn between
// this check and the decision it authorizes: the withdrawal waits for the decision to finish.
export async function holdsActivePlatformRole(
  transaction: DatabaseTransaction,
  userId: string,
  roles: readonly PlatformRole[],
): Promise<boolean> {
  if (roles.length === 0) return false;
  const [assignment] = await transaction
    .select({ id: platformRoleAssignments.id })
    .from(platformRoleAssignments)
    .where(
      and(
        eq(platformRoleAssignments.userId, userId),
        eq(platformRoleAssignments.status, "active"),
        inArray(platformRoleAssignments.role, [...roles]),
      ),
    )
    .for("share")
    .limit(1);
  return assignment !== undefined;
}
