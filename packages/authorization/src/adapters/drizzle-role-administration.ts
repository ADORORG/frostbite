import type { DatabaseClient } from "@frostbite/database/connection";
import { authUsers } from "@frostbite/database/schema/auth";
import { eq } from "drizzle-orm";

import type { RoleAdministrationRepository } from "../application/role-administration.ts";
import {
  activateRole,
  effectiveAdminIds,
  isEffectiveAdmin,
  lockRoleChanges,
  suspendRole,
  type RoleRules,
} from "./role-assignment.ts";

export function createDrizzleRoleAdministration(
  database: DatabaseClient,
  rules: RoleRules,
): RoleAdministrationRepository {
  return {
    grant: (input) =>
      database.transaction(async (transaction) => {
        await lockRoleChanges(transaction);
        // Only an administrator whose own role works may change anyone's.
        if (!(await isEffectiveAdmin(transaction, input.actorUserId, rules)))
          return { kind: "forbidden" };
        const [target] = await transaction
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, input.targetUserId))
          .limit(1);
        if (target === undefined) return { kind: "unknown-user" };
        const kind = await activateRole(transaction, input, {
          ...input,
          via: "role-screen",
        });
        const held = await rules.heldKinds(transaction, input.targetUserId);
        const effective = (rules.requiredMethods[input.role] ?? []).every(
          (needed) => held.has(needed),
        );
        return { effective, kind };
      }),

    suspend: (input) =>
      database.transaction(async (transaction) => {
        await lockRoleChanges(transaction);
        if (!(await isEffectiveAdmin(transaction, input.actorUserId, rules)))
          return { kind: "forbidden" };
        const [target] = await transaction
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, input.targetUserId))
          .limit(1);
        if (target === undefined) return { kind: "unknown-user" };
        // Nobody may take away the last working administrator, themselves included: the role screen would have no one left to use it.
        if (input.role === "admin") {
          const working = await effectiveAdminIds(transaction, rules);
          if (
            working.includes(input.targetUserId) &&
            working.every((id) => id === input.targetUserId)
          )
            return { kind: "last-admin" };
        }
        return {
          kind: await suspendRole(transaction, input, {
            ...input,
            via: "role-screen",
          }),
        };
      }),
  };
}
