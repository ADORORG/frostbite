import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";
import type { GameSyncService } from "@ador/game-saves";
import {
  gameSyncRoute,
  syncGameStateInputSchema,
  syncGameStateResponseSchema,
  type SyncGameStateInput,
  type SyncGameStateResponse,
} from "@ador/shared/games";

// Saves a signed-in player's local state for a game to their account and returns the merged state. Naturally
// idempotent (the merge changes nothing when replayed), so it takes no key: a retry after a lost answer is
// safe. Only the person's own state is reachable: the owner is the session, never a field of the request.
export function createSyncGameStateOperation(
  getService: () => Promise<GameSyncService>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["invalid_request", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).sync(context.actorUserId, input);
      switch (outcome.kind) {
        case "synced":
          return {
            ok: true,
            value: { ...outcome.state, playerId: outcome.playerId },
          } as const;
        case "unknown-game":
          return failure("not_found", "The game was not found.");
        case "unknown-milestone":
          return failure(
            "invalid_request",
            "A milestone is not one this game declares.",
          );
        case "no-target":
          return failure(
            "invalid_request",
            "A total was reported for a milestone that has no target.",
          );
        case "too-large":
          return failure("invalid_request", "The saved progress is too large.");
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: syncGameStateInputSchema,
    outputSchema: syncGameStateResponseSchema,
    ...gameSyncRoute,
  } satisfies HttpOperation<SyncGameStateInput, SyncGameStateResponse>;
}
