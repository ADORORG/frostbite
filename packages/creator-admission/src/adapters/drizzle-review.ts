import type { DatabaseClient } from "@ador/database/connection";
import {
  creatorApplications,
  creatorApplicationSnapshots,
} from "@ador/database/schema/creator-admission";
import { authUsers } from "@ador/database/schema/auth";
import { platformRoleAssignments } from "@ador/database/schema/accounts";
import { resolveCreatorAdmissionTransition } from "@ador/shared/creator-admission";
import { and, desc, eq, inArray } from "drizzle-orm";

import type {
  CreatorAdmissionRepository,
  CreatorMutationResult,
} from "../application/repository.ts";
import {
  applicationView,
  insertAdmissionEvent,
  lockedApplication,
  replayMutation,
} from "./drizzle-helpers.ts";

// A reviewer's decision on an application. It locks the application, rechecks the reviewer's authority
// inside the transaction, applies the lifecycle rule, and records the decision as an audit event, all
// together; a repeated request replays the first answer.
export async function review(
  database: DatabaseClient,
  input: Parameters<CreatorAdmissionRepository["review"]>[0],
): Promise<CreatorMutationResult> {
  return database.transaction(async (transaction) => {
    const repeated = await replayMutation(
      transaction,
      input,
      input.applicationId,
    );
    if (repeated !== null) return repeated;
    const application = await lockedApplication(
      transaction,
      input.applicationId,
    );
    if (application === undefined) return { kind: "not-found" };
    const serializedReplay = await replayMutation(
      transaction,
      input,
      application.id,
    );
    if (serializedReplay !== null) return serializedReplay;
    if (application.applicantUserId === input.actorUserId)
      return { kind: "forbidden" };
    if (input.allowedReviewerRoles.length === 0) return { kind: "forbidden" };
    const [assignment] = await transaction
      .select({ id: platformRoleAssignments.id })
      .from(platformRoleAssignments)
      .where(
        and(
          eq(platformRoleAssignments.userId, input.actorUserId),
          eq(platformRoleAssignments.status, "active"),
          inArray(platformRoleAssignments.role, [
            ...input.allowedReviewerRoles,
          ]),
        ),
      )
      .limit(1);
    if (assignment === undefined) return { kind: "forbidden" };
    const nextState = resolveCreatorAdmissionTransition(
      application.state,
      input.action,
    );
    if (nextState === null) return { kind: "conflict" };
    const [latest] = await transaction
      .select({ id: creatorApplicationSnapshots.id })
      .from(creatorApplicationSnapshots)
      .where(eq(creatorApplicationSnapshots.applicationId, application.id))
      .orderBy(desc(creatorApplicationSnapshots.sequence))
      .limit(1);
    if (latest === undefined) return { kind: "conflict" };
    if (input.action === "approve") {
      const [identity] = await transaction
        .select({ emailVerified: authUsers.emailVerified })
        .from(authUsers)
        .where(eq(authUsers.id, application.applicantUserId))
        .limit(1);
      if (identity?.emailVerified !== true)
        return { kind: "contact-unverified" };
    }
    const [saved] = await transaction
      .update(creatorApplications)
      .set({ state: nextState, updatedAt: input.changedAt })
      .where(eq(creatorApplications.id, application.id))
      .returning();
    if (saved === undefined) return { kind: "conflict" };
    await insertAdmissionEvent(transaction, {
      ...input,
      nextState,
      previousState: application.state,
      snapshotId: latest.id,
    });
    return {
      application: await applicationView(transaction, saved),
      kind: "changed",
    };
  });
}
