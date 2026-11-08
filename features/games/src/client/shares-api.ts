import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import {
  createShareResponseSchema,
  createShareRoute,
  type CreateShareInput,
  type CreateShareResponse,
} from "@frostbite/shared/games";

import { claimRequestTimeoutMs } from "./claims-api.ts";

// Making a link for something the signed-in player earned, as the page reaches it: one same-origin request with the player's session.
// A failure (including no session) is thrown as the requester throws it, for the caller to say.
export interface SharesApi {
  create(input: CreateShareInput): Promise<CreateShareResponse>;
}

export function createSharesApi(
  fetchImpl: FetchLike = sameOriginFetch,
): SharesApi {
  const request = createRequester(fetchImpl);
  return {
    create: (input) =>
      request(createShareRoute, createShareResponseSchema, {
        body: input,
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
  };
}
