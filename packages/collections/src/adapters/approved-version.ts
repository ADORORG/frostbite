import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@frostbite/database/connection";
import {
  collectionReviewEvents,
  collectionSubmissions,
} from "@frostbite/database/schema/collection-submissions";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import { creatorApplications } from "@frostbite/database/schema/creator-admission";
import { and, desc, eq, sql } from "drizzle-orm";

import type {
  ApprovedCollectionSummary,
  ApprovedVersion,
  ApprovedVersionReader,
} from "../application/approved-version.ts";
import { isApprovedCreator, isApprovedCreatorNow } from "./guards.ts";

type Reader = Pick<DatabaseClient, "select">;

async function latestApproved(
  reader: Reader,
  collectionId: string,
  lock: boolean,
) {
  const query = reader
    .select()
    .from(collectionSubmissions)
    .where(
      and(
        eq(collectionSubmissions.collectionId, collectionId),
        eq(collectionSubmissions.state, "approved"),
      ),
    )
    // At most one submission of a collection is live (a unique index), so at most one is approved.
    .limit(1);
  const [row] = lock ? await query.for("share") : await query;
  return row;
}

async function approvedAt(reader: Reader, submissionId: string): Promise<Date> {
  const [event] = await reader
    .select({ createdAt: collectionReviewEvents.createdAt })
    .from(collectionReviewEvents)
    .where(
      and(
        eq(collectionReviewEvents.submissionId, submissionId),
        eq(collectionReviewEvents.nextState, "approved"),
      ),
    )
    .orderBy(desc(collectionReviewEvents.createdAt))
    .limit(1);
  if (event === undefined)
    throw new Error("An approved submission has no approval event");
  return event.createdAt;
}

// The approved version of a collection, held so it cannot be withdrawn while the caller acts on it.
// Takes shared locks on the approved submission row and then on the creator's application row (the
// order a decision uses), so a revocation, a suspension, or a withdrawal of the approval that is in
// flight waits until the caller's transaction ends, and one that has committed is seen here. Returns
// null when there is no approved version or its creator is no longer approved. Publication and
// deployment must call this inside the transaction that records what they do.
export async function lockApprovedVersion(
  transaction: DatabaseTransaction,
  collectionId: string,
): Promise<ApprovedVersion | null> {
  const row = await latestApproved(transaction, collectionId, true);
  if (row === undefined) return null;
  if (!(await isApprovedCreator(transaction, row.ownerUserId))) return null;
  return versionOf(row, await approvedAt(transaction, row.id));
}

function versionOf(
  row: typeof collectionSubmissions.$inferSelect,
  approved: Date,
): ApprovedVersion {
  return {
    approvedAt: approved,
    collectionId: uuidV7Schema.parse(row.collectionId),
    ownerUserId: uuidV7Schema.parse(row.ownerUserId),
    payloadHash: row.payloadHash,
    sequence: row.sequence,
    snapshot: row.snapshot,
    submissionId: uuidV7Schema.parse(row.id),
  };
}

export function createDrizzleApprovedVersionReader(
  database: DatabaseClient,
): ApprovedVersionReader {
  return {
    async listApprovedCollections(limit) {
      // Read from the snapshot's own fields in SQL, so a list never loads every item of every collection.
      const snapshot = collectionSubmissions.snapshot;
      const rows = await database
        .select({
          approvedAt: collectionSubmissions.updatedAt,
          collectionId: collectionSubmissions.collectionId,
          coverAssetId: sql<
            string | null
          >`${snapshot}->'collection'->>'coverAssetId'`,
          description: sql<string>`${snapshot}->'collection'->>'description'`,
          itemCount: sql<number>`jsonb_array_length(${snapshot}->'items')`,
          name: sql<string>`${snapshot}->'collection'->>'name'`,
          ownerUserId: collectionSubmissions.ownerUserId,
          plannedSupply: sql<number>`(${snapshot}->'collection'->>'plannedSupply')::int`,
          targetChain: sql<string>`${snapshot}->'collection'->>'targetChain'`,
        })
        .from(collectionSubmissions)
        .innerJoin(
          creatorApplications,
          eq(
            creatorApplications.applicantUserId,
            collectionSubmissions.ownerUserId,
          ),
        )
        .where(
          and(
            eq(collectionSubmissions.state, "approved"),
            eq(creatorApplications.state, "approved"),
          ),
        )
        .orderBy(
          desc(collectionSubmissions.updatedAt),
          desc(collectionSubmissions.id),
        )
        .limit(limit);
      return rows.map((row): ApprovedCollectionSummary => ({
        ...row,
        collectionId: uuidV7Schema.parse(row.collectionId),
        ownerUserId: uuidV7Schema.parse(row.ownerUserId),
      }));
    },

    async findApprovedVersion(collectionId) {
      const row = await latestApproved(database, collectionId, false);
      if (row === undefined) return null;
      return (await isApprovedCreatorNow(database, row.ownerUserId))
        ? versionOf(row, await approvedAt(database, row.id))
        : null;
    },
  };
}
