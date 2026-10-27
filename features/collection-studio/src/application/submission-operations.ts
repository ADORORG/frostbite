import type { createSubmissionService, SubmitResult } from "@ador/collections";
import type { HttpOperation } from "@ador/http";
import {
  collectionSubmissionListSchema,
  collectionSubmissionResponseSchema,
  listCollectionSubmissionsInputSchema,
  submissionRequirementCopy,
  submissionRoutes,
  submitCollectionInputSchema,
  type CollectionSubmissionList,
  type CollectionSubmissionResponse,
  type ListCollectionSubmissionsInput,
  type SubmitCollectionInput,
} from "@ador/shared/collections";
import { uuidV7Schema } from "@ador/shared/identifiers";

import {
  commonFailures,
  failure,
  idempotencyKeyConflict,
  revisionConflict,
  unauthenticated,
} from "./outcome.ts";
import { presentSubmission } from "./present-submission.ts";

export type SubmissionService = ReturnType<typeof createSubmissionService>;
type Resolve = () => Promise<SubmissionService>;

type Refusal = Exclude<SubmitResult, { kind: "replayed" | "submitted" }>;

// Each way a submission can be refused, as one stable HTTP error with words the creator can act on.
function refusal(result: Refusal) {
  switch (result.kind) {
    case "conflict":
      return idempotencyKeyConflict;
    case "not-ready":
      return failure(
        "invalid_request",
        `This collection is not ready to submit. It needs ${result.missing.map((need) => submissionRequirementCopy[need]).join(", ")}.`,
      );
    case "not-submittable":
      return failure(
        "conflict",
        result.reason === "in-review"
          ? "This collection already has a submission in review or approved."
          : "A submission of this collection was closed, so it cannot be submitted again.",
      );
    case "revision-conflict":
      return revisionConflict;
    case "invalid-asset":
    case "invalid-chain":
    case "not-eligible":
    case "not-found":
      return commonFailures[result.kind];
  }
}

export function createSubmitCollectionOperation(getService: Resolve) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: [
      "conflict",
      "forbidden",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      const result = await (
        await getService()
      ).submit(
        {
          collectionId: uuidV7Schema.parse(input.collectionId),
          expectedRevision: input.expectedRevision,
        },
        {
          actorUserId: context.actorUserId,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        },
      );
      if (result.kind === "submitted" || result.kind === "replayed")
        return {
          ok: true,
          value: { submission: presentSubmission(result.submission) },
        } as const;
      return refusal(result);
    },
    idempotency: "required",
    input: "json",
    inputSchema: submitCollectionInputSchema,
    outputSchema: collectionSubmissionResponseSchema,
    ...submissionRoutes.submit,
  } satisfies HttpOperation<
    SubmitCollectionInput,
    CollectionSubmissionResponse
  >;
}

export function createListSubmissionsOperation(getService: Resolve) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const records = await (
        await getService()
      ).listForOwner({
        collectionId: uuidV7Schema.parse(input.collectionId),
        ownerUserId: context.actorUserId,
      });
      return {
        ok: true,
        value: { submissions: records.map(presentSubmission) },
      } as const;
    },
    idempotency: "none",
    cache: { kind: "revalidate" },
    input: "query",
    inputSchema: listCollectionSubmissionsInputSchema,
    outputSchema: collectionSubmissionListSchema,
    ...submissionRoutes.list,
  } satisfies HttpOperation<
    ListCollectionSubmissionsInput,
    CollectionSubmissionList
  >;
}
