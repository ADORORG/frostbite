import type { DatabaseClient } from "@ador/database/connection";
import {
  creatorAdmissionEvents,
  creatorApplications,
  creatorApplicationSnapshots,
} from "@ador/database/schema/creator-admission";
import { authUsers } from "@ador/database/schema/auth";
import type { CreatorReviewSort } from "@ador/shared/creator-admission";
import { uuidV7Schema } from "@ador/shared/identifiers";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  max,
  sql,
} from "drizzle-orm";

import type {
  CreatorAdmissionRepository,
  CreatorReviewQueueRow,
} from "../application/repository.ts";

type Reader = Pick<DatabaseClient, "select">;
const snapshots = creatorApplicationSnapshots;

// Time to the millisecond, as fixed-width text that sorts and compares as the time does: the precision the
// app writes, so a cursor made from a row and the rows it is compared with agree exactly. Both sorts' keys
// are text, so one comparison serves them.
const sentAt = sql<string>`to_char(date_trunc('milliseconds', ${snapshots.createdAt}) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const nameKey = sql<string>`lower(${snapshots.payload}->>'displayName')`;

// How each sort orders the list, and how "after this row" reads: a row-wise comparison on the sort key and
// the id, so rows with the same key still have a place and none is skipped or repeated.
function ordering(sort: CreatorReviewSort) {
  switch (sort) {
    case "oldest":
      return {
        after: ">",
        key: sentAt,
        order: [asc(sentAt), asc(creatorApplications.id)],
      };
    case "newest":
      return {
        after: "<",
        key: sentAt,
        order: [desc(sentAt), desc(creatorApplications.id)],
      };
    case "name":
      return {
        after: ">",
        key: nameKey,
        order: [asc(nameKey), asc(creatorApplications.id)],
      };
  }
}

// The latest submission of each application: nothing is listed that was never sent.
function latestSubmissions(database: Reader) {
  return database
    .select({
      applicationId: snapshots.applicationId,
      sequence: max(snapshots.sequence).as("latest_sequence"),
    })
    .from(snapshots)
    .groupBy(snapshots.applicationId)
    .as("latest_submission");
}

export async function listForReview(
  database: Reader,
  input: Parameters<CreatorAdmissionRepository["listForReview"]>[0],
): Promise<readonly CreatorReviewQueueRow[]> {
  const latest = latestSubmissions(database);
  const { after, key, order } = ordering(input.sort);
  const cursor = input.position;
  const rows = await database
    .select({
      applicationId: creatorApplications.id,
      displayName: sql<string>`${snapshots.payload}->>'displayName'`,
      sortKey: sql<string>`${key}`,
      state: creatorApplications.state,
      submissionNumber: snapshots.sequence,
      submittedAt: snapshots.createdAt,
      updatedAt: creatorApplications.updatedAt,
    })
    .from(creatorApplications)
    .innerJoin(latest, eq(latest.applicationId, creatorApplications.id))
    .innerJoin(
      snapshots,
      and(
        eq(snapshots.applicationId, creatorApplications.id),
        eq(snapshots.sequence, latest.sequence),
      ),
    )
    .where(
      and(
        inArray(creatorApplications.state, [...input.states]),
        cursor === null
          ? undefined
          : sql`(${key}, ${creatorApplications.id}) ${sql.raw(after)} (${cursor.key}::text, ${cursor.id}::uuid)`,
      ),
    )
    .orderBy(...order)
    .limit(input.limit);
  return rows.map((row) => ({
    ...row,
    applicationId: uuidV7Schema.parse(row.applicationId),
  }));
}

export async function countsForReview(database: Reader) {
  const rows = await database
    .select({ n: count(), state: creatorApplications.state })
    .from(creatorApplications)
    .where(
      exists(
        database
          .select({ one: sql`1` })
          .from(snapshots)
          .where(eq(snapshots.applicationId, creatorApplications.id)),
      ),
    )
    .groupBy(creatorApplications.state);
  return new Map(rows.map(({ n, state }) => [state, n]));
}

export async function readForReview(
  database: Reader,
  applicationId: string,
): ReturnType<CreatorAdmissionRepository["readForReview"]> {
  const [row] = await database
    .select({
      application: creatorApplications,
      snapshot: snapshots,
    })
    .from(creatorApplications)
    .innerJoin(snapshots, eq(snapshots.applicationId, creatorApplications.id))
    .where(eq(creatorApplications.id, applicationId))
    .orderBy(desc(snapshots.sequence))
    .limit(1);
  if (row === undefined) return null;
  const events = await database
    .select({
      action: creatorAdmissionEvents.action,
      actorName: authUsers.name,
      createdAt: creatorAdmissionEvents.createdAt,
      creatorFeedback: creatorAdmissionEvents.creatorFeedback,
      nextState: creatorAdmissionEvents.nextState,
      previousState: creatorAdmissionEvents.previousState,
      privateNotes: creatorAdmissionEvents.privateNotes,
      reasonCode: creatorAdmissionEvents.reasonCode,
    })
    .from(creatorAdmissionEvents)
    .innerJoin(authUsers, eq(authUsers.id, creatorAdmissionEvents.actorUserId))
    .where(eq(creatorAdmissionEvents.applicationId, applicationId))
    .orderBy(
      asc(creatorAdmissionEvents.createdAt),
      asc(creatorAdmissionEvents.id),
    );
  return {
    applicationId: uuidV7Schema.parse(row.application.id),
    events,
    snapshot: row.snapshot.payload,
    state: row.application.state,
    submissionNumber: row.snapshot.sequence,
    submittedAt: row.snapshot.createdAt,
  };
}
