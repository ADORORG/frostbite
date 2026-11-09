import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import {
  getLeaderboardResponseSchema,
  getLeaderboardRoute,
  getMyRankResponseSchema,
  getMyRankRoute,
  type GetLeaderboardResponse,
  type GetMyRankResponse,
  type LeaderboardWindow,
} from "@frostbite/shared/games";

import { claimRequestTimeoutMs } from "./claims-api.ts";

// A game's leaderboard as the page reaches it: the public board, and the signed-in player's own place. A failure is thrown as the
// requester throws it, for the caller to say.
export interface LeaderboardApi {
  board(
    gameId: string,
    window: LeaderboardWindow,
  ): Promise<GetLeaderboardResponse>;
  mine(
    gameId: string,
    window: LeaderboardWindow,
  ): Promise<GetMyRankResponse["place"]>;
}

export function createLeaderboardApi(
  fetchImpl: FetchLike = sameOriginFetch,
): LeaderboardApi {
  const request = createRequester(fetchImpl);
  return {
    board: (gameId, window) =>
      request(getLeaderboardRoute, getLeaderboardResponseSchema, {
        query: { gameId, window },
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
    mine: async (gameId, window) =>
      (
        await request(getMyRankRoute, getMyRankResponseSchema, {
          query: { gameId, window },
          signal: AbortSignal.timeout(claimRequestTimeoutMs),
        })
      ).place,
  };
}
