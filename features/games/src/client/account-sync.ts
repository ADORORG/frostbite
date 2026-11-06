import {
  ApiError,
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import type { AccountPort } from "@frostbite/game-sdk/synced-backend";
import {
  gameSyncRoute,
  syncGameStateResponseSchema,
} from "@frostbite/shared/games";

// How long a sync may take before it counts as failed. The game's first read waits for the first sync, and a
// game gives up on the platform after ten seconds, so this leaves the game time to start from the browser's
// own copy when the account is slow.
export const accountSyncTimeoutMs = 5_000;

// The account as the host page reaches it: one same-origin request that sends the browser's state and gets
// the merged state back. A 401 means nobody is signed in, which is not an error; any other failure is
// reported as one so the page says it has not saved to the account.
export function createAccountPort(
  gameId: string,
  fetchImpl: FetchLike = sameOriginFetch,
  timeoutMs: number = accountSyncTimeoutMs,
): AccountPort {
  const request = createRequester(fetchImpl);
  return {
    sync: async (state) => {
      try {
        const merged = await request(
          gameSyncRoute,
          syncGameStateResponseSchema,
          {
            body: { gameId, state },
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        const { playerId, ...saved } = merged;
        return { kind: "synced", playerId, state: saved };
      } catch (error) {
        return error instanceof ApiError && error.code === "unauthorized"
          ? { kind: "signed-out" }
          : { kind: "failed" };
      }
    },
  };
}
