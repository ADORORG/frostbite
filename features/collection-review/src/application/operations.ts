import type { DecideResult, createReviewService } from "@ador/collections";
import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";
import {
  collectionReviewCapability,
  decideReviewInputSchema,
  readReviewSubmissionInputSchema,
  reviewQueueInputSchema,
  reviewQueueResponseSchema,
  reviewRoutes,
  reviewSubmissionResponseSchema,
  type ReviewDecision,
  type ReviewQueueInput,
  type ReviewQueueResponse,
  type ReviewSubmissionResponse,
} from "@ador/shared/collections";
import { uuidV7Schema } from "@ador/shared/identifiers";

import { presentQueueItem, presentReviewSubmission } from "./present.ts";

export type ReviewService = ReturnType<typeof createReviewService>;
type Resolve = () => Promise<ReviewService>;

const access = {
  capability: collectionReviewCapability,
  kind: "platform",
} as const;

type Refusal = Exclude<DecideResult, { kind: "decided" | "replayed" }>;

function refusal(result: Refusal) {
  switch (result.kind) {
    case "conflict":
      return failure(
        "conflict",
        "The idempotency key conflicts with another request.",
      );
    case "forbidden":
      return failure("forbidden", "This decision is not permitted.");
    case "invalid-transition":
      return failure(
        "conflict",
        `This submission is ${result.state} and cannot take that action.`,
      );
    case "not-found":
      return failure("not_found", "The submission was not found.");
    case "owner-not-eligible":
      return failure(
        "conflict",
        "The creator is no longer an approved creator, so this cannot be approved.",
      );
  }
}

export function createDecideOperation(getService: Resolve) {
  return {
    access,
    applicationErrors: ["conflict", "forbidden", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      const result = await (
        await getService()
      ).decide(input, {
        actorUserId: context.actorUserId,
        correlationId: context.correlationId,
        idempotencyKey: context.idempotencyKey,
      });
      if (result.kind === "decided" || result.kind === "replayed")
        return {
          ok: true,
          value: { submission: presentReviewSubmission(result.submission) },
        } as const;
      return refusal(result);
    },
    idempotency: "required",
    input: "json",
    inputSchema: decideReviewInputSchema,
    outputSchema: reviewSubmissionResponseSchema,
    ...reviewRoutes.decide,
  } satisfies HttpOperation<ReviewDecision, ReviewSubmissionResponse>;
}

export function createQueueOperation(getService: Resolve) {
  return {
    access,
    applicationErrors: ["forbidden", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const items = await (await getService()).queue(input.states);
      return {
        ok: true,
        value: { items: items.map(presentQueueItem) },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: reviewQueueInputSchema,
    outputSchema: reviewQueueResponseSchema,
    ...reviewRoutes.queue,
  } satisfies HttpOperation<ReviewQueueInput, ReviewQueueResponse>;
}

export function createReadOperation(getService: Resolve) {
  return {
    access,
    applicationErrors: ["forbidden", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const record = await (
        await getService()
      ).readForReview(uuidV7Schema.parse(input.submissionId));
      return record === null
        ? failure("not_found", "The submission was not found.")
        : ({
            ok: true,
            value: { submission: presentReviewSubmission(record) },
          } as const);
    },
    idempotency: "none",
    input: "json",
    inputSchema: readReviewSubmissionInputSchema,
    outputSchema: reviewSubmissionResponseSchema,
    ...reviewRoutes.read,
  } satisfies HttpOperation<
    { readonly submissionId: string },
    ReviewSubmissionResponse
  >;
}
