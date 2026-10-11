import { sameOriginFetch } from "@ador/client-http";

import { createCreatorReviewApi, type CreatorReviewApi } from "./review-api.ts";

// Everything the review pages need from the browser, in one injectable bundle, so components and hooks
// never reach for `fetch` themselves and tests can substitute fakes.
export interface ReviewClientServices {
  readonly api: CreatorReviewApi;
}

export function createBrowserServices(): ReviewClientServices {
  return { api: createCreatorReviewApi(sameOriginFetch) };
}
