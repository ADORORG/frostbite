import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import {
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
  type ListMintedMilestonesResponse,
} from "@ador/shared/games";

import { claimRequestTimeoutMs } from "./claims-api.ts";

// What the signed-in player has minted, as the page reaches it: one same-origin request with the player's session. A failure
// (including no session) is thrown as the requester throws it, for the caller to say.
export interface MintedApi {
  list(): Promise<ListMintedMilestonesResponse>;
}

export function createMintedApi(
  fetchImpl: FetchLike = sameOriginFetch,
): MintedApi {
  const request = createRequester(fetchImpl);
  return {
    list: () =>
      request(listMintedMilestonesRoute, listMintedMilestonesResponseSchema, {
        body: {},
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
  };
}
