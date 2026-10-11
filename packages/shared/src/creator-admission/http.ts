import { z } from "zod";

import {
  creatorApplicationDraftSchema,
  creatorApplicationStateSchema,
  creatorReviewDecisionSchema,
} from "./contracts.ts";
import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";

// The latest message a reviewer wrote for the applicant (never the private notes). Null until a reviewer
// has written one.
export const creatorApplicationFeedbackSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    text: z.string().min(1),
  })
  .strict();

export const creatorApplicationViewSchema = z
  .object({
    applicantUserId: uuidV7TextSchema,
    draft: creatorApplicationDraftSchema,
    feedback: creatorApplicationFeedbackSchema.nullable(),
    id: uuidV7TextSchema,
    revision: z.number().int().positive(),
    state: creatorApplicationStateSchema,
  })
  .strict();

export const creatorApplicationResponseSchema = z
  .object({ application: creatorApplicationViewSchema })
  .strict();
export const creatorApplicationDraftInputSchema = z
  .object({ draft: creatorApplicationDraftSchema })
  .strict();
export const creatorApplicationEmptyInputSchema = z.object({}).strict();
export const creatorApplicationReviewInputSchema = creatorReviewDecisionSchema
  .omit({ applicationId: true })
  .extend({ applicationId: uuidV7TextSchema })
  .strict();

export const creatorApplicationRoutes = Object.freeze({
  mine: {
    method: "GET",
    operationId: "getCreatorApplication",
    path: "/api/v1/creator-application",
  },
  review: {
    method: "POST",
    operationId: "reviewCreatorApplication",
    path: "/api/v1/creator-application/review",
  },
  reviewQueue: {
    method: "POST",
    operationId: "listCreatorApplicationReviewQueue",
    path: "/api/v1/creator-application/review-queue",
  },
  reviewRead: {
    method: "POST",
    operationId: "readCreatorApplicationForReview",
    path: "/api/v1/creator-application/review-read",
  },
  saveDraft: {
    method: "PUT",
    operationId: "saveCreatorApplicationDraft",
    path: "/api/v1/creator-application/draft",
  },
  submit: {
    method: "POST",
    operationId: "submitCreatorApplication",
    path: "/api/v1/creator-application/submit",
  },
} as const);

export type CreatorApplicationResponse = z.infer<
  typeof creatorApplicationResponseSchema
>;
export type CreatorApplicationDraftInput = z.infer<
  typeof creatorApplicationDraftInputSchema
>;
export type CreatorApplicationEmptyInput = z.infer<
  typeof creatorApplicationEmptyInputSchema
>;
export type CreatorApplicationReviewInput = z.infer<
  typeof creatorApplicationReviewInputSchema
>;
