import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import {
  getMintedPictureResponseSchema,
  getMintedPictureRoute,
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
  type GetMintedPictureResponse,
  type ListMintedMilestonesResponse,
} from "@ador/shared/games";

import { claimRequestTimeoutMs } from "./claims-api.ts";

// What the signed-in player has minted, as the page reaches it: one same-origin request with the player's session. A failure
// (including no session) is thrown as the requester throws it, for the caller to say.
export interface MintedApi {
  list(): Promise<ListMintedMilestonesResponse>;
  picture(claimId: string): Promise<GetMintedPictureResponse>;
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
    picture: (claimId) =>
      request(getMintedPictureRoute, getMintedPictureResponseSchema, {
        body: { claimId },
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
  };
}
