import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import {
  listGalleryMintsResponseSchema,
  listGalleryMintsRoute,
  type ListGalleryMintsResponse,
} from "@frostbite/shared/games";

import { claimRequestTimeoutMs } from "./claims-api.ts";

// A game's public gallery of mints, as the page reaches it: one same-origin request a page, no session needed. A failure is thrown as the
// requester throws it, for the caller to say.
export interface GalleryApi {
  list(gameId: string, cursor?: string): Promise<ListGalleryMintsResponse>;
}

export function createGalleryApi(
  fetchImpl: FetchLike = sameOriginFetch,
): GalleryApi {
  const request = createRequester(fetchImpl);
  return {
    list: (gameId, cursor) =>
      request(listGalleryMintsRoute, listGalleryMintsResponseSchema, {
        query: cursor === undefined ? { gameId } : { cursor, gameId },
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
  };
}
