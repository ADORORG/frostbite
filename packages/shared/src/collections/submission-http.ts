import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import {
  submissionActionSchema,
  submissionStateSchema,
} from "./review-state.ts";

const timestamp = z.iso.datetime({ offset: true });

// A decision as the creator sees it: what was decided and the feedback written for them. Private
// notes, the reviewer's identity, and reason codes stay with staff.
export const submissionDecisionSchema = z
  .object({
    action: submissionActionSchema,
    createdAt: timestamp,
    creatorFeedback: z.string(),
    nextState: submissionStateSchema,
  })
  .strict();

export const collectionSubmissionSchema = z
  .object({
    collectionId: uuidV7TextSchema,
    collectionRevision: z.number().int().positive(),
    createdAt: timestamp,
    decisions: z.array(submissionDecisionSchema),
    id: uuidV7TextSchema,
    payloadHash: z.string().regex(/^[0-9a-f]{64}$/u),
    sequence: z.number().int().positive(),
    state: submissionStateSchema,
    updatedAt: timestamp,
  })
  .strict();

// Naming the revision the creator last saw means a draft changed on another device since is refused
// rather than silently submitted: what is frozen is exactly what the creator was looking at.
export const submitCollectionInputSchema = z
  .object({
    collectionId: uuidV7TextSchema,
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const listCollectionSubmissionsInputSchema = z
  .object({ collectionId: uuidV7TextSchema })
  .strict();

export const collectionSubmissionResponseSchema = z
  .object({ submission: collectionSubmissionSchema })
  .strict();
export const collectionSubmissionListSchema = z
  .object({ submissions: z.array(collectionSubmissionSchema) })
  .strict();

export const submissionRoutes = {
  list: {
    method: "POST",
    operationId: "listCollectionSubmissions",
    path: "/api/v1/collection-submissions/list",
  },
  submit: {
    method: "POST",
    operationId: "submitCollection",
    path: "/api/v1/collection-submissions",
  },
} as const;

export type CollectionSubmission = z.infer<typeof collectionSubmissionSchema>;
export type CollectionSubmissionList = z.infer<
  typeof collectionSubmissionListSchema
>;
export type CollectionSubmissionResponse = z.infer<
  typeof collectionSubmissionResponseSchema
>;
export type ListCollectionSubmissionsInput = z.infer<
  typeof listCollectionSubmissionsInputSchema
>;
export type SubmitCollectionInput = z.infer<typeof submitCollectionInputSchema>;
