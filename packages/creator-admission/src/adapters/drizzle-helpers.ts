import { createHash } from "node:crypto";

import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import {
  creatorAdmissionEvents,
  creatorApplications,
} from "@ador/database/schema/creator-admission";
import {
  creatorReviewActions,
  type CreatorAdmissionAction,
} from "@ador/shared/creator-admission";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type {
  CreatorApplicationView,
  CreatorMutationResult,
  MutationContext,
} from "../application/repository.ts";

export function snapshotHash(
  payload: typeof creatorApplications.$inferSelect.draft,
) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

type Reader = Pick<DatabaseClient, "select">;

// The newest message a reviewer wrote for the applicant: the newest non-empty `creatorFeedback` among the
// reviewer's own decisions (never the applicant's events, whatever they hold). Ties on the time are broken by
// the event id, which is time-ordered, so the answer is always the same. Private notes are never read here.
async function latestFeedback(
  database: Reader,
  applicationId: string,
): Promise<CreatorApplicationView["feedback"]> {
  const [event] = await database
    .select({
      createdAt: creatorAdmissionEvents.createdAt,
      text: creatorAdmissionEvents.creatorFeedback,
    })
    .from(creatorAdmissionEvents)
    .where(
      and(
        eq(creatorAdmissionEvents.applicationId, applicationId),
        inArray(creatorAdmissionEvents.action, [...creatorReviewActions]),
        ne(creatorAdmissionEvents.creatorFeedback, ""),
      ),
    )
    .orderBy(
      desc(creatorAdmissionEvents.createdAt),
      desc(creatorAdmissionEvents.id),
    )
    .limit(1);
  return event ?? null;
}

export async function applicationView(
  database: Reader,
  row: typeof creatorApplications.$inferSelect,
): Promise<CreatorApplicationView> {
  return {
    applicantUserId: uuidV7Schema.parse(row.applicantUserId),
    draft: row.draft,
    feedback: await latestFeedback(database, row.id),
    id: uuidV7Schema.parse(row.id),
    revision: row.revision,
    state: row.state,
  };
}

export async function lockedApplication(
  transaction: DatabaseTransaction,
  applicationId: string,
) {
  const [application] = await transaction
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.id, applicationId))
    .for("update")
    .limit(1);
  return application;
}

export async function lockApplicant(
  transaction: DatabaseTransaction,
  applicantUserId: string,
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${applicantUserId}, 0))`,
  );
}

export async function replayMutation(
  transaction: DatabaseTransaction,
  input: MutationContext,
  applicationId?: string,
): Promise<CreatorMutationResult | null> {
  const [event] = await transaction
    .select({
      actorUserId: creatorAdmissionEvents.actorUserId,
      applicationId: creatorAdmissionEvents.applicationId,
      requestFingerprint: creatorAdmissionEvents.requestFingerprint,
    })
    .from(creatorAdmissionEvents)
    .where(eq(creatorAdmissionEvents.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (event === undefined) return null;
  if (
    event.actorUserId !== input.actorUserId ||
    event.requestFingerprint !== input.requestFingerprint ||
    (applicationId !== undefined && event.applicationId !== applicationId)
  ) {
    return { kind: "conflict" };
  }
  const application = await lockedApplication(transaction, event.applicationId);
  return application === undefined
    ? { kind: "conflict" }
    : {
        application: await applicationView(transaction, application),
        kind: "replayed",
      };
}

export async function insertAdmissionEvent(
  transaction: DatabaseTransaction,
  input: MutationContext & {
    readonly action: CreatorAdmissionAction;
    readonly applicationId: string;
    readonly creatorFeedback?: string;
    readonly evidenceReferences?: readonly string[];
    readonly nextState: typeof creatorApplications.$inferSelect.state;
    readonly previousState: typeof creatorApplications.$inferSelect.state;
    readonly privateNotes?: string;
    readonly reasonCode: string;
    readonly snapshotId?: string;
  },
) {
  await transaction.insert(creatorAdmissionEvents).values({
    action: input.action,
    actorUserId: input.actorUserId,
    applicationId: input.applicationId,
    correlationId: input.correlationId,
    createdAt: input.changedAt,
    creatorFeedback: input.creatorFeedback,
    evidenceReferences: input.evidenceReferences,
    id: createUuidV7(),
    idempotencyKey: input.idempotencyKey,
    nextState: input.nextState,
    policyVersion: input.policyVersion,
    previousState: input.previousState,
    privateNotes: input.privateNotes,
    reasonCode: input.reasonCode,
    requestFingerprint: input.requestFingerprint,
    snapshotId: input.snapshotId,
  });
}
