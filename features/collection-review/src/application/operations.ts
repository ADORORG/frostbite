import type { DecideResult, createReviewService } from "@frostbite/collections";
import type { HttpOperation } from "@frostbite/http";
import {
  failure,
  idempotencyKeyConflict,
  unauthenticated,
  invalidCursor,
} from "@frostbite/http/outcome";
import {
  collectionReviewCapability,
  decodeActivityCursor,
  reviewActivityInputSchema,
  reviewActivityResponseSchema,
  type ReviewActivityInput,
  type ReviewActivityResponse,
  decideReviewInputSchema,
  readReviewSubmissionInputSchema,
  reviewQueueInputSchema,
  reviewQueueResponseSchema,
  reviewRoutes,
  reviewDetailResponseSchema,
  reviewSubmissionResponseSchema,
  type ReviewDecision,
  type ReviewDetailResponse,
  type ReviewQueueInput,
  type ReviewQueueResponse,
  type ReviewSubmissionResponse,
} from "@frostbite/shared/collections";
import { uuidV7Schema } from "@frostbite/shared/identifiers";

import {
  presentActivity,
  presentQueueItem,
  presentReviewSubmission,
} from "./present.ts";
import type { createAssetLibraryService } from "@frostbite/uploads";

export type ReviewService = ReturnType<typeof createReviewService>;
export type AssetPreviews = Pick<
  ReturnType<typeof createAssetLibraryService>,
  "getMany"
>;
type Resolve = () => Promise<ReviewService>;

// One answer for a submission that is not there, wherever it is asked for.
const submissionNotFound = failure(
  "not_found",
  "The submission was not found.",
);

const access = {
  capability: collectionReviewCapability,
  kind: "platform",
} as const;

type Refusal = Exclude<DecideResult, { kind: "decided" | "replayed" }>;

function refusal(result: Refusal) {
  switch (result.kind) {
    case "conflict":
      return idempotencyKeyConflict;
    case "forbidden":
      return failure("forbidden", "This decision is not permitted.");
    case "invalid-transition":
      return failure(
        "conflict",
        `This submission is ${result.state} and cannot take that action.`,
      );
    case "not-found":
      return submissionNotFound;
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
    cache: { kind: "no-store" },
    input: "query",
    inputSchema: reviewQueueInputSchema,
    outputSchema: reviewQueueResponseSchema,
    ...reviewRoutes.queue,
  } satisfies HttpOperation<ReviewQueueInput, ReviewQueueResponse>;
}

export function createReadOperation(
  getService: Resolve,
  getPreviews: () => Promise<AssetPreviews>,
) {
  return {
    access,
    applicationErrors: ["forbidden", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const record = await (
        await getService()
      ).readForReview(uuidV7Schema.parse(input.submissionId));
      if (record === null) return submissionNotFound;
      // Only the images frozen into this submission are signed, as its creator's own assets.
      const ids = record.snapshot.assets.map(({ id }) =>
        uuidV7Schema.parse(id),
      );
      const previews =
        ids.length === 0
          ? []
          : await (await getPreviews()).getMany(record.ownerUserId, ids);
      return {
        ok: true,
        value: {
          previews: [...previews],
          submission: presentReviewSubmission(record),
        },
      } as const;
    },
    idempotency: "none",
    cache: { kind: "no-store" },
    input: "query",
    inputSchema: readReviewSubmissionInputSchema,
    outputSchema: reviewDetailResponseSchema,
    ...reviewRoutes.read,
  } satisfies HttpOperation<
    { readonly submissionId: string },
    ReviewDetailResponse
  >;
}

export function createActivityOperation(getService: Resolve) {
  return {
    access,
    applicationErrors: ["forbidden", "invalid_request", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const position =
        input.cursor === null ? null : decodeActivityCursor(input.cursor);
      // A cursor the log did not produce is refused, not treated as the start of the log.
      if (input.cursor !== null && position === null) return invalidCursor;
      const page = await (
        await getService()
      ).activity(
        position === null
          ? null
          : {
              createdAt: new Date(position.createdAt),
              id: uuidV7Schema.parse(position.id),
            },
      );
      return { ok: true, value: presentActivity(page) } as const;
    },
    idempotency: "none",
    cache: { kind: "no-store" },
    input: "query",
    inputSchema: reviewActivityInputSchema,
    outputSchema: reviewActivityResponseSchema,
    ...reviewRoutes.activity,
  } satisfies HttpOperation<ReviewActivityInput, ReviewActivityResponse>;
}
