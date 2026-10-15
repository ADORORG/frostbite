import {
  ApiError,
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import type { RunsService } from "@ador/game-sdk/host";
import {
  startGameRunResponseSchema,
  startGameRunRoute,
  submitGameRunResponseSchema,
  submitGameRunRoute,
} from "@ador/shared/games";

// How long a request for a run, and a submission, may take. A submission waits for a replay on the server, so it is given
// longer; both are well inside the ten seconds a game waits on the platform.
export const startRunTimeoutMs = 5_000;
export const submitRunTimeoutMs = 8_000;

// Runs as the host page reaches them: one same-origin request each, with the player's session. Nobody signed in is not an
// error but an answer the game can act on (`signed-out`: play on, self-reported). Any other failure is thrown, which the host
// reports to the game as the platform being unavailable, without the reason.
export function createRunsService(
  gameId: string,
  fetchImpl: FetchLike = sameOriginFetch,
): RunsService {
  const request = createRequester(fetchImpl);
  const signedOut = (error: unknown) =>
    error instanceof ApiError && error.code === "unauthorized";
  return {
    start: async () => {
      try {
        return await request(startGameRunRoute, startGameRunResponseSchema, {
          body: { gameId },
          signal: AbortSignal.timeout(startRunTimeoutMs),
        });
      } catch (error) {
        if (signedOut(error))
          return { reason: "signed-out", status: "unavailable" };
        throw error;
      }
    },
    submit: (runId, record) =>
      request(submitGameRunRoute, submitGameRunResponseSchema, {
        body: { gameId, record, runId },
        signal: AbortSignal.timeout(submitRunTimeoutMs),
      }),
  };
}
