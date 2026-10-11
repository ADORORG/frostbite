import { sameOriginFetch } from "@ador/client-http";
import { idempotencyKeySchema, type IdempotencyKey } from "@ador/shared/http";

import {
  createCollectionsApi,
  type CollectionsApi,
} from "./collections-api.ts";

// Everything the browser UI needs from its environment, in one injectable bundle, so components and
// hooks never reach for `fetch` or `crypto` themselves and tests can substitute fakes.
export interface CollectionsClientServices {
  readonly api: CollectionsApi;
  createIdempotencyKey(): IdempotencyKey;
  // Moves the browser to another page; replaced in tests so nothing actually navigates.
  navigate(href: string): void;
}

export function createBrowserServices(
  overrides: Partial<CollectionsClientServices> = {},
): CollectionsClientServices {
  return {
    api: createCollectionsApi(sameOriginFetch),
    createIdempotencyKey: () => idempotencyKeySchema.parse(crypto.randomUUID()),
    navigate: (href) => globalThis.location.assign(href),
    ...overrides,
  };
}
