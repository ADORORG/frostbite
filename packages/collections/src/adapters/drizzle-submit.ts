import type { DatabaseClient } from "@frostbite/database/connection";
import {
  collectionReviewEvents,
  collectionSubmissions,
} from "@frostbite/database/schema/collection-submissions";
import { collectionItems } from "@frostbite/database/schema/collections";
import {
  collectionAssetPurposes,
  liveSubmissionStates,
  missingSubmissionRequirements,
} from "@frostbite/shared/collections";
import { requestFingerprint } from "@frostbite/shared/http";
import { and, asc, desc, eq } from "drizzle-orm";

import type { SubmissionAuthoring } from "../application/submission-repository.ts";
import { buildSnapshot } from "./snapshot-builder.ts";
import {
  draftAssetReferences,
  editCollection,
  findValidAssets,
  lockIdempotencyKey,
} from "./guards.ts";
import { loadEvents, submissionRecord } from "./submission-views.ts";

const submitReasonCode = "creator-submitted";

// Freezes the creator's collection as a new submission. One transaction holds the collection row, so a
// draft change cannot land between what is checked and what is frozen: the snapshot is exactly the
// revision the creator named, with every image verified and hashed at that moment.
function submit(database: DatabaseClient): SubmissionAuthoring["submit"] {
  return (input) =>
    editCollection(
      database,
      input.actorUserId,
      input.collectionId,
      async (transaction, locked) => {
        await lockIdempotencyKey(transaction, input.idempotencyKey);
        const [repeated] = await transaction
          .select()
          .from(collectionReviewEvents)
          .where(
            eq(collectionReviewEvents.idempotencyKey, input.idempotencyKey),
          )
          .limit(1);
        if (repeated !== undefined) {
          const [row] = await transaction
            .select()
            .from(collectionSubmissions)
            .where(eq(collectionSubmissions.id, repeated.submissionId))
            .limit(1);
          return row !== undefined &&
            repeated.action === "submit" &&
            row.collectionId === input.collectionId &&
            repeated.requestFingerprint === input.requestFingerprint
            ? {
                kind: "replayed",
                submission: submissionRecord(
                  row,
                  await loadEvents(transaction, [row.id]),
                ),
              }
            : { kind: "conflict" };
        }
        if (locked.revision !== input.expectedRevision)
          return {
            currentRevision: locked.revision,
            kind: "revision-conflict",
          };
        if (!input.allowedChains.includes(locked.chainId))
          return { kind: "invalid-chain" };
        const [latest] = await transaction
          .select({
            sequence: collectionSubmissions.sequence,
            state: collectionSubmissions.state,
          })
          .from(collectionSubmissions)
          .where(eq(collectionSubmissions.collectionId, locked.id))
          .orderBy(desc(collectionSubmissions.sequence))
          .limit(1);
        // Only a collection whose last submission came back as "changes requested" can be submitted again.
        if (latest !== undefined && latest.state !== "changes-requested")
          return {
            kind: "not-submittable",
            reason: liveSubmissionStates.some((live) => live === latest.state)
              ? "in-review"
              : "closed",
          };
        const items = await transaction
          .select()
          .from(collectionItems)
          .where(eq(collectionItems.collectionId, locked.id))
          .orderBy(asc(collectionItems.position));
        const missing = missingSubmissionRequirements({
          collection: {
            coverAssetId: locked.coverAssetId,
            description: locked.description,
            plannedSupply: locked.plannedSupply,
          },
          itemCount: items.length,
        });
        if (missing.length > 0) return { kind: "not-ready", missing };
        const references = [
          ...draftAssetReferences({
            bannerAssetId: locked.bannerAssetId,
            coverAssetId: locked.coverAssetId,
          }),
          ...items.map(({ imageAssetId }) => ({
            id: imageAssetId,
            purpose: collectionAssetPurposes.item,
          })),
        ];
        const assets = await findValidAssets(
          transaction,
          input.actorUserId,
          references,
        );
        const valid = new Set(
          assets.map(({ id, purpose }) => `${id}:${purpose}`),
        );
        const invalid = references.find(
          ({ id, purpose }) => !valid.has(`${id}:${purpose}`),
        );
        if (invalid !== undefined)
          return { assetId: invalid.id, kind: "invalid-asset" };
        const snapshot = buildSnapshot({ assets, collection: locked, items });
        const [row] = await transaction
          .insert(collectionSubmissions)
          .values({
            collectionId: locked.id,
            collectionRevision: locked.revision,
            createdAt: input.changedAt,
            id: input.submissionId,
            ownerUserId: input.actorUserId,
            payloadHash: requestFingerprint(snapshot),
            schemaVersion: snapshot.schemaVersion,
            sequence: (latest?.sequence ?? 0) + 1,
            snapshot,
            updatedAt: input.changedAt,
          })
          .returning();
        if (row === undefined)
          throw new Error("Inserted submission is missing");
        const [event] = await transaction
          .insert(collectionReviewEvents)
          .values({
            action: "submit",
            actorUserId: input.actorUserId,
            correlationId: input.correlationId,
            createdAt: input.changedAt,
            id: input.eventId,
            idempotencyKey: input.idempotencyKey,
            nextState: "submitted",
            policyVersion: input.policyVersion,
            reasonCode: submitReasonCode,
            requestFingerprint: input.requestFingerprint,
            submissionId: row.id,
          })
          .returning();
        if (event === undefined) throw new Error("Inserted event is missing");
        return {
          kind: "submitted",
          submission: submissionRecord(row, [event]),
        };
      },
    );
}

export function createDrizzleAuthoring(
  database: DatabaseClient,
): SubmissionAuthoring {
  return {
    async listForOwner({ collectionId, ownerUserId }) {
      const rows = await database
        .select()
        .from(collectionSubmissions)
        .where(
          and(
            eq(collectionSubmissions.collectionId, collectionId),
            eq(collectionSubmissions.ownerUserId, ownerUserId),
          ),
        )
        .orderBy(desc(collectionSubmissions.sequence));
      const events = await loadEvents(
        database,
        rows.map(({ id }) => id),
      );
      return rows.map((row) => submissionRecord(row, events));
    },

    submit: submit(database),
  };
}
