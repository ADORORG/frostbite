import type { DatabaseClient } from "@ador/database/connection";
import { authUsers } from "@ador/database/schema/auth";
import {
  collectionReviewEvents,
  collectionSubmissions,
} from "@ador/database/schema/collection-submissions";
import { collections } from "@ador/database/schema/collections";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { desc, eq, sql } from "drizzle-orm";

import type { ReviewRepository } from "../application/submission-repository.ts";

// The activity log: every event of every submission, newest first, cut into pages at the position of
// the last event seen (time, then id), so a page is stable while new events arrive. One more row than
// the page holds is read, only to know whether an older page exists.
export function createDrizzleActivity(
  database: DatabaseClient,
): Pick<ReviewRepository, "activity"> {
  return {
    async activity({ cursor, limit }) {
      const rows = await database
        .select({
          action: collectionReviewEvents.action,
          actorName: authUsers.name,
          actorUserId: collectionReviewEvents.actorUserId,
          collectionId: collectionSubmissions.collectionId,
          collectionName: collections.name,
          createdAt: collectionReviewEvents.createdAt,
          eventId: collectionReviewEvents.id,
          nextState: collectionReviewEvents.nextState,
          previousState: collectionReviewEvents.previousState,
          reasonCode: collectionReviewEvents.reasonCode,
          sequence: collectionSubmissions.sequence,
          submissionId: collectionReviewEvents.submissionId,
        })
        .from(collectionReviewEvents)
        .innerJoin(
          collectionSubmissions,
          eq(collectionSubmissions.id, collectionReviewEvents.submissionId),
        )
        .innerJoin(
          collections,
          eq(collections.id, collectionSubmissions.collectionId),
        )
        .innerJoin(
          authUsers,
          eq(authUsers.id, collectionReviewEvents.actorUserId),
        )
        .where(
          cursor === null
            ? undefined
            : sql`(${collectionReviewEvents.createdAt}, ${collectionReviewEvents.id}) < (${cursor.createdAt}, ${cursor.id})`,
        )
        .orderBy(
          desc(collectionReviewEvents.createdAt),
          desc(collectionReviewEvents.id),
        )
        .limit(limit + 1);
      const page = rows.slice(0, limit).map((row) => ({
        ...row,
        actorUserId: uuidV7Schema.parse(row.actorUserId),
        collectionId: uuidV7Schema.parse(row.collectionId),
        eventId: uuidV7Schema.parse(row.eventId),
        submissionId: uuidV7Schema.parse(row.submissionId),
      }));
      const last = page.at(-1);
      return {
        items: page,
        next:
          rows.length > limit && last !== undefined
            ? { createdAt: last.createdAt, id: last.eventId }
            : null,
      };
    },
  };
}
