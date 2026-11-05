import type { DatabaseTransaction } from "@frostbite/database/connection";
import {
  platformRoleAssignments,
  platformRoleEvents,
} from "@frostbite/database/schema/accounts";
import type { PlatformRole } from "@frostbite/shared/accounts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { and, eq, sql } from "drizzle-orm";

import {
  effectiveRoles,
  type RoleRequirements,
} from "../application/effective-roles.ts";
import type { HeldKinds } from "./drizzle-authorization-repository.ts";

// The pieces every change to who holds a platform role is made of, run inside the caller's transaction. Role changes are rare, so they
// are serialized platform-wide: two at once cannot each see the other's administrator still in place.

export interface RoleRules {
  readonly heldKinds: HeldKinds;
  readonly requiredMethods: RoleRequirements;
}

export interface EventContext {
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now: Date;
  readonly policyVersion: string;
  readonly via: "role-screen" | "setup-link";
}

export async function lockRoleChanges(
  transaction: DatabaseTransaction,
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('platform-role-changes', 0))`,
  );
}

// Every active administrator whose role works, i.e. who holds the sign-in methods the policy asks of an administrator.
export async function effectiveAdminIds(
  transaction: DatabaseTransaction,
  rules: RoleRules,
): Promise<readonly string[]> {
  const admins = await transaction
    .select({ userId: platformRoleAssignments.userId })
    .from(platformRoleAssignments)
    .where(
      and(
        eq(platformRoleAssignments.role, "admin"),
        eq(platformRoleAssignments.status, "active"),
      ),
    );
  const working: string[] = [];
  for (const { userId } of admins) {
    const held = await rules.heldKinds(transaction, userId);
    if (effectiveRoles(["admin"], held, rules.requiredMethods).length === 1)
      working.push(userId);
  }
  return working;
}

export async function isEffectiveAdmin(
  transaction: DatabaseTransaction,
  userId: string,
  rules: RoleRules,
): Promise<boolean> {
  return (await effectiveAdminIds(transaction, rules)).includes(userId);
}

export type Activation = "granted" | "reinstated" | "unchanged";

// Makes the role active for the user: creates it, reinstates a suspended one, or finds it already active and writes nothing (a
// repeated request leaves no second piece of evidence).
export async function activateRole(
  transaction: DatabaseTransaction,
  input: { readonly role: PlatformRole; readonly targetUserId: string },
  context: EventContext,
): Promise<Activation> {
  const [existing] = await transaction
    .select()
    .from(platformRoleAssignments)
    .where(
      and(
        eq(platformRoleAssignments.userId, input.targetUserId),
        eq(platformRoleAssignments.role, input.role),
      ),
    )
    .for("update")
    .limit(1);
  if (existing?.status === "active") return "unchanged";
  if (existing === undefined) {
    await transaction.insert(platformRoleAssignments).values({
      id: createUuidV7(),
      role: input.role,
      status: "active",
      userId: input.targetUserId,
    });
  } else {
    await transaction
      .update(platformRoleAssignments)
      .set({ status: "active", updatedAt: context.now })
      .where(eq(platformRoleAssignments.id, existing.id));
  }
  const action = existing === undefined ? "granted" : "reinstated";
  await writeEvent(transaction, input, context, {
    action,
    previousStatus: existing?.status ?? null,
    nextStatus: "active",
  });
  return action;
}

// Suspends the role if the user holds it active; a role already suspended or never given is left, with nothing written.
export async function suspendRole(
  transaction: DatabaseTransaction,
  input: { readonly role: PlatformRole; readonly targetUserId: string },
  context: EventContext,
): Promise<"suspended" | "unchanged"> {
  const [existing] = await transaction
    .select()
    .from(platformRoleAssignments)
    .where(
      and(
        eq(platformRoleAssignments.userId, input.targetUserId),
        eq(platformRoleAssignments.role, input.role),
      ),
    )
    .for("update")
    .limit(1);
  if (existing === undefined || existing.status === "suspended")
    return "unchanged";
  await transaction
    .update(platformRoleAssignments)
    .set({ status: "suspended", updatedAt: context.now })
    .where(eq(platformRoleAssignments.id, existing.id));
  await writeEvent(transaction, input, context, {
    action: "suspended",
    previousStatus: "active",
    nextStatus: "suspended",
  });
  return "suspended";
}

async function writeEvent(
  transaction: DatabaseTransaction,
  input: { readonly role: PlatformRole; readonly targetUserId: string },
  context: EventContext,
  change: {
    readonly action: "granted" | "reinstated" | "suspended";
    readonly nextStatus: "active" | "suspended";
    readonly previousStatus: "active" | "suspended" | null;
  },
): Promise<void> {
  await transaction.insert(platformRoleEvents).values({
    action: change.action,
    actorUserId: context.actorUserId,
    correlationId: context.correlationId,
    createdAt: context.now,
    id: createUuidV7(),
    nextStatus: change.nextStatus,
    policyVersion: context.policyVersion,
    previousStatus: change.previousStatus,
    role: input.role,
    targetUserId: input.targetUserId,
    via: context.via,
  });
}
