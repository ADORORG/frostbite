import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import { libraryAssetSchema } from "../uploads/library-contracts.ts";
import { collectionSubmissionSchema } from "./submission-http.ts";
import { submissionSnapshotSchema } from "./snapshot.ts";
import {
  reviewDecisionSchema,
  submissionActionSchema,
  submissionStateSchema,
  submissionStates,
} from "./review-state.ts";

const timestamp = z.iso.datetime({ offset: true });

// What staff see of the queue: enough to choose what to open, never the creator's private details.
export const reviewQueueItemSchema = z
  .object({
    collectionId: uuidV7TextSchema,
    collectionName: z.string(),
    createdAt: timestamp,
    id: uuidV7TextSchema,
    sequence: z.number().int().positive(),
    state: submissionStateSchema,
    updatedAt: timestamp,
  })
  .strict();

// The full audit trail of one submission for staff, including what the creator never sees.
export const reviewEventSchema = z
  .object({
    action: submissionActionSchema,
    actorUserId: uuidV7TextSchema,
    createdAt: timestamp,
    creatorFeedback: z.string(),
    nextState: submissionStateSchema,
    previousState: submissionStateSchema.nullable(),
    privateNotes: z.string(),
    reasonCode: z.string(),
  })
  .strict();

export const reviewSubmissionSchema = collectionSubmissionSchema
  .omit({ decisions: true })
  .extend({
    events: z.array(reviewEventSchema),
    ownerUserId: uuidV7TextSchema,
    snapshot: submissionSnapshotSchema,
  })
  .strict();

export const reviewQueueInputSchema = z
  .object({
    states: z.array(submissionStateSchema).min(1).max(submissionStates.length),
  })
  .strict();
export const readReviewSubmissionInputSchema = z
  .object({ submissionId: uuidV7TextSchema })
  .strict();
export const decideReviewInputSchema = reviewDecisionSchema;

export const reviewQueueResponseSchema = z
  .object({ items: z.array(reviewQueueItemSchema) })
  .strict();
export const reviewSubmissionResponseSchema = z
  .object({ submission: reviewSubmissionSchema })
  .strict();

// The submission in full with short-lived signed previews of every image in its snapshot (ADR-016),
// so a reviewer sees the art. Never store these URLs.
export const reviewDetailResponseSchema = z
  .object({
    previews: z.array(libraryAssetSchema),
    submission: reviewSubmissionSchema,
  })
  .strict();

export const reviewRoutes = {
  decide: {
    method: "POST",
    operationId: "decideCollectionReview",
    path: "/api/v1/collection-reviews/decide",
  },
  queue: {
    method: "POST",
    operationId: "listCollectionReviewQueue",
    path: "/api/v1/collection-reviews/queue",
  },
  read: {
    method: "POST",
    operationId: "readCollectionReviewSubmission",
    path: "/api/v1/collection-reviews/read",
  },
} as const;

export type ReviewDetailResponse = z.infer<typeof reviewDetailResponseSchema>;
export type ReviewEvent = z.infer<typeof reviewEventSchema>;
export type ReviewQueueInput = z.infer<typeof reviewQueueInputSchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
export type ReviewSubmissionResponse = z.infer<
  typeof reviewSubmissionResponseSchema
>;
