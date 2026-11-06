import type { DatabaseClient } from "@frostbite/database/connection";
import {
  creatorApplications,
  creatorApplicationSnapshots,
} from "@frostbite/database/schema/creator-admission";
import { authUsers } from "@frostbite/database/schema/auth";
import {
  creatorApplicationSubmissionSchema,
  resolveCreatorAdmissionTransition,
} from "@frostbite/shared/creator-admission";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { desc, eq } from "drizzle-orm";

import type { CreatorAdmissionRepository } from "../application/repository.ts";
import { review } from "./drizzle-review.ts";
import {
  countsForReview,
  listForReview,
  readForReview,
} from "./drizzle-review-queue.ts";
import {
  applicationView,
  insertAdmissionEvent,
  lockApplicant,
  replayMutation,
  snapshotHash,
} from "./drizzle-helpers.ts";
const applicantDraftReason = "applicant-saved-draft";
const applicantSubmissionReason = "applicant-submitted";

export function createDrizzleCreatorAdmissionRepository(
  database: DatabaseClient,
): CreatorAdmissionRepository {
  return {
    review: (input) => review(database, input),
    countsForReview: () => countsForReview(database),
    listForReview: (input) => listForReview(database, input),
    readForReview: (applicationId) => readForReview(database, applicationId),

    async findForApplicant(applicantUserId) {
      const [application] = await database
        .select()
        .from(creatorApplications)
        .where(eq(creatorApplications.applicantUserId, applicantUserId))
        .limit(1);
      return application === undefined
        ? null
        : applicationView(database, application);
    },

    async saveDraft(input) {
      return database.transaction(async (transaction) => {
        const repeated = await replayMutation(transaction, input);
        if (repeated !== null) return repeated;
        await lockApplicant(transaction, input.actorUserId);
        const serializedReplay = await replayMutation(transaction, input);
        if (serializedReplay !== null) return serializedReplay;
        const [existing] = await transaction
          .select()
          .from(creatorApplications)
          .where(eq(creatorApplications.applicantUserId, input.actorUserId))
          .for("update")
          .limit(1);
        if (
          existing !== undefined &&
          !["draft", "changes-requested"].includes(existing.state)
        ) {
          return { kind: "conflict" };
        }
        const previousState = existing?.state ?? "draft";
        const nextRevision = (existing?.revision ?? 0) + 1;
        const [saved] =
          existing === undefined
            ? await transaction
                .insert(creatorApplications)
                .values({
                  applicantUserId: input.actorUserId,
                  createdAt: input.changedAt,
                  draft: input.draft,
                  id: input.applicationId,
                  revision: nextRevision,
                  updatedAt: input.changedAt,
                })
                .returning()
            : await transaction
                .update(creatorApplications)
                .set({
                  draft: input.draft,
                  revision: nextRevision,
                  updatedAt: input.changedAt,
                })
                .where(eq(creatorApplications.id, existing.id))
                .returning();
        if (saved === undefined) return { kind: "conflict" };
        await insertAdmissionEvent(transaction, {
          ...input,
          action: "save-draft",
          applicationId: saved.id,
          nextState: saved.state,
          previousState,
          reasonCode: applicantDraftReason,
        });
        return {
          application: await applicationView(transaction, saved),
          kind: "changed",
        };
      });
    },

    async submit(input) {
      return database.transaction(async (transaction) => {
        const repeated = await replayMutation(transaction, input);
        if (repeated !== null) return repeated;
        const [application] = await transaction
          .select()
          .from(creatorApplications)
          .where(eq(creatorApplications.applicantUserId, input.actorUserId))
          .for("update")
          .limit(1);
        if (application === undefined) return { kind: "not-found" };
        const serializedReplay = await replayMutation(
          transaction,
          input,
          application.id,
        );
        if (serializedReplay !== null) return serializedReplay;
        const snapshotPayload = creatorApplicationSubmissionSchema.parse(
          application.draft,
        );
        const action = application.state === "draft" ? "submit" : "resubmit";
        const nextState = resolveCreatorAdmissionTransition(
          application.state,
          action,
        );
        if (nextState === null) return { kind: "conflict" };
        const [identity] = await transaction
          .select({
            email: authUsers.email,
            emailVerified: authUsers.emailVerified,
          })
          .from(authUsers)
          .where(eq(authUsers.id, input.actorUserId))
          .limit(1);
        if (identity?.emailVerified !== true)
          return { kind: "contact-unverified" };
        const [latest] = await transaction
          .select({ sequence: creatorApplicationSnapshots.sequence })
          .from(creatorApplicationSnapshots)
          .where(eq(creatorApplicationSnapshots.applicationId, application.id))
          .orderBy(desc(creatorApplicationSnapshots.sequence))
          .limit(1);
        const snapshotId = createUuidV7();
        await transaction.insert(creatorApplicationSnapshots).values({
          applicationId: application.id,
          createdAt: input.changedAt,
          id: snapshotId,
          payload: snapshotPayload,
          payloadHash: snapshotHash(snapshotPayload),
          schemaVersion: input.schemaVersion,
          sequence: (latest?.sequence ?? 0) + 1,
          submittedByUserId: input.actorUserId,
          verifiedContactEmail: identity.email,
        });
        const [saved] = await transaction
          .update(creatorApplications)
          .set({ state: nextState, updatedAt: input.changedAt })
          .where(eq(creatorApplications.id, application.id))
          .returning();
        if (saved === undefined) return { kind: "conflict" };
        await insertAdmissionEvent(transaction, {
          ...input,
          action,
          applicationId: application.id,
          nextState,
          previousState: application.state,
          reasonCode: applicantSubmissionReason,
          snapshotId,
        });
        return {
          application: await applicationView(transaction, saved),
          kind: "changed",
        };
      });
    },
  };
}
