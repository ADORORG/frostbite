import { createRequester, type FetchLike } from "@ador/client-http";
import {
  reviewDetailResponseSchema,
  reviewQueueResponseSchema,
  reviewRoutes,
  reviewSubmissionResponseSchema,
  type ReviewDecision,
  type ReviewDetailResponse,
  type ReviewQueueResponse,
  type ReviewSubmissionResponse,
  type SubmissionState,
} from "@ador/shared/collections";
import type { IdempotencyKey } from "@ador/shared/http";

export interface CallOptions {
  readonly signal?: AbortSignal;
}

export interface ReviewApi {
  decide(
    input: ReviewDecision,
    options: CallOptions & { readonly idempotencyKey: IdempotencyKey },
  ): Promise<ReviewSubmissionResponse>;
  queue(
    states: readonly SubmissionState[],
    options?: CallOptions,
  ): Promise<ReviewQueueResponse>;
  read(
    submissionId: string,
    options?: CallOptions,
  ): Promise<ReviewDetailResponse>;
}

// The browser's view of the review API; requests and error handling are the shared requester's, so
// every response is validated against the shared contract.
export function createReviewApi(fetchImpl: FetchLike): ReviewApi {
  const request = createRequester(fetchImpl);
  return {
    decide: (input, options) =>
      request(reviewRoutes.decide, reviewSubmissionResponseSchema, {
        body: input,
        ...options,
      }),
    queue: (states, options = {}) =>
      request(reviewRoutes.queue, reviewQueueResponseSchema, {
        body: { states: [...states] },
        ...options,
      }),
    read: (submissionId, options = {}) =>
      request(reviewRoutes.read, reviewDetailResponseSchema, {
        body: { submissionId },
        ...options,
      }),
  };
}
