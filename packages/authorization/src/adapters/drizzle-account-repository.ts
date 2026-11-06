import {
  accountAuditEvents,
  organizationMemberships,
  organizations,
} from "@frostbite/database/schema/accounts";
import type { DatabaseClient } from "@frostbite/database/connection";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import type {
  AccountRepository,
  MembershipMutationResult,
} from "../application/account-repository.ts";

export function createDrizzleAccountRepository(
  database: DatabaseClient,
): AccountRepository {
  return {
    async createOrganization(input) {
      await database.transaction(async (transaction) => {
        await transaction.insert(organizations).values({
          id: input.organizationId,
          name: input.name,
        });
        await transaction.insert(organizationMemberships).values({
          id: createUuidV7(),
          organizationId: input.organizationId,
          role: "owner",
          status: "active",
          userId: input.actorUserId,
        });
        await transaction.insert(accountAuditEvents).values({
          action: "organization-created",
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          createdAt: input.changedAt,
          id: createUuidV7(),
          nextRole: "owner",
          nextStatus: "active",
          organizationId: input.organizationId,
          policyVersion: input.policyVersion,
          reasonCode: "organization-created",
          targetUserId: input.actorUserId,
        });
      });
    },

    async changeMembership(input): Promise<MembershipMutationResult> {
      return database.transaction(async (transaction) => {
        const [organization] = await transaction
          .select({ status: organizations.status })
          .from(organizations)
          .where(eq(organizations.id, input.organizationId))
          .for("update")
          .limit(1);
        if (organization === undefined) return { kind: "not-found" };
        if (organization.status !== "active") return { kind: "forbidden" };

        const [actor] = await transaction
          .select({ role: organizationMemberships.role })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, input.organizationId),
              eq(organizationMemberships.userId, input.actorUserId),
              eq(organizationMemberships.status, "active"),
              inArray(organizationMemberships.role, [
                ...input.allowedActorRoles,
              ]),
            ),
          )
          .limit(1);
        if (actor === undefined) return { kind: "forbidden" };

        const [previous] = await transaction
          .select({
            id: organizationMemberships.id,
            role: organizationMemberships.role,
            status: organizationMemberships.status,
          })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, input.organizationId),
              eq(organizationMemberships.userId, input.targetUserId),
            ),
          )
          .limit(1);
        const removesActiveOwner =
          previous?.role === "owner" &&
          previous.status === "active" &&
          (input.nextRole !== "owner" || input.nextStatus !== "active");
        const changesOwnership =
          previous?.role === "owner" || input.nextRole === "owner";
        if (changesOwnership && !input.ownershipStepUpVerified)
          return { kind: "forbidden" };
        if (removesActiveOwner) {
          const [remaining] = await transaction
            .select({ count: sql<number>`count(*)::integer` })
            .from(organizationMemberships)
            .where(
              and(
                eq(
                  organizationMemberships.organizationId,
                  input.organizationId,
                ),
                eq(organizationMemberships.role, "owner"),
                eq(organizationMemberships.status, "active"),
                ne(organizationMemberships.userId, input.targetUserId),
              ),
            );
          if ((remaining?.count ?? 0) === 0) return { kind: "last-owner" };
        }

        await transaction
          .insert(organizationMemberships)
          .values({
            id: previous?.id ?? createUuidV7(),
            organizationId: input.organizationId,
            role: input.nextRole,
            status: input.nextStatus,
            userId: input.targetUserId,
          })
          .onConflictDoUpdate({
            set: {
              role: input.nextRole,
              status: input.nextStatus,
              updatedAt: input.changedAt,
            },
            target: [
              organizationMemberships.organizationId,
              organizationMemberships.userId,
            ],
          });
        await transaction.insert(accountAuditEvents).values({
          action:
            previous === undefined
              ? "membership-created"
              : "membership-updated",
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          createdAt: input.changedAt,
          id: createUuidV7(),
          nextRole: input.nextRole,
          nextStatus: input.nextStatus,
          organizationId: input.organizationId,
          policyVersion: input.policyVersion,
          reasonCode: input.reasonCode,
          previousRole: previous?.role,
          previousStatus: previous?.status,
          targetUserId: input.targetUserId,
        });
        return { kind: "changed" };
      });
    },
  };
}
