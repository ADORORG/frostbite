import { createRequester, type FetchLike } from "@ador/client-http";
import {
  creatorApplicationRoutes,
  creatorReviewQueueResponseSchema,
  creatorReviewReadResponseSchema,
  type CreatorReviewGroup,
  type CreatorReviewQueueResponse,
  type CreatorReviewReadResponse,
  type CreatorReviewSort,
} from "@ador/shared/creator-admission";

export interface CallOptions {
  readonly signal?: AbortSignal;
}

export interface CreatorReviewApi {
  // One page of the queue; a null cursor is the first page.
  queue(
    input: {
      readonly cursor: string | null;
      readonly group: CreatorReviewGroup;
      readonly sort: CreatorReviewSort;
    },
    options?: CallOptions,
  ): Promise<CreatorReviewQueueResponse>;
  read(
    applicationId: string,
    options?: CallOptions,
  ): Promise<CreatorReviewReadResponse>;
}

// The browser's view of the creator review API; requests and error handling are the shared requester's, so
// every response is validated against the shared contract.
export function createCreatorReviewApi(fetchImpl: FetchLike): CreatorReviewApi {
  const request = createRequester(fetchImpl);
  return {
    queue: (input, options = {}) =>
      request(
        creatorApplicationRoutes.reviewQueue,
        creatorReviewQueueResponseSchema,
        { body: input, ...options },
      ),
    read: (applicationId, options = {}) =>
      request(
        creatorApplicationRoutes.reviewRead,
        creatorReviewReadResponseSchema,
        { body: { applicationId }, ...options },
      ),
  };
}
