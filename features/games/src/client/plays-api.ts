import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import {
  recordGamePlayResponseSchema,
  recordGamePlayRoute,
} from "@frostbite/shared/games";

// How long counting a start may take before it is given up on; it is never waited for.
export const recordPlayTimeoutMs = 3_000;

// Tells the platform a run was started in a game, so the games played most can be shown as hot. It never throws and is never waited for: a
// start that is not counted (over the allowance, offline, a server error) changes nothing for the player or the game.
export function recordPlay(
  gameId: string,
  fetchImpl: FetchLike = sameOriginFetch,
): void {
  createRequester(fetchImpl)(
    recordGamePlayRoute,
    recordGamePlayResponseSchema,
    { body: { gameId }, signal: AbortSignal.timeout(recordPlayTimeoutMs) },
  ).catch(() => undefined);
}
