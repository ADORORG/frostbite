import { sameOriginFetch } from "@ador/client-http";
import { idempotencyKeySchema, type IdempotencyKey } from "@ador/shared/http";

import { createReviewApi, type ReviewApi } from "./review-api.ts";

// Everything the browser UI needs from its environment, in one injectable bundle, so components and
// hooks never reach for `fetch` or `crypto` themselves and tests can substitute fakes.
export interface ReviewClientServices {
  readonly api: ReviewApi;
  createIdempotencyKey(): IdempotencyKey;
}

export function createBrowserServices(
  overrides: Partial<ReviewClientServices> = {},
): ReviewClientServices {
  return {
    api: createReviewApi(sameOriginFetch),
    createIdempotencyKey: () => idempotencyKeySchema.parse(crypto.randomUUID()),
    ...overrides,
  };
}
