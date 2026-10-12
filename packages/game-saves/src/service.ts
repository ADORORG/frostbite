import {
  mergeGameState,
  type GameState,
  type SyncGameStateInput,
} from "@ador/shared/games";

import type { GameSyncRepository } from "./repository.ts";

export type SyncOutcome =
  | { readonly kind: "synced"; readonly state: GameState }
  | { readonly kind: "unknown-game" }
  | { readonly kind: "unknown-milestone"; readonly id: string }
  | { readonly kind: "too-large" };

export interface GameSyncService {
  sync(userId: string, input: SyncGameStateInput): Promise<SyncOutcome>;
}

// Syncs a signed-in player's local state with their account. The authoritative checks are here, not in the
// page: the game must be one the platform lists, every milestone must be one that game declares, and the save
// must fit the configured size. The merge is the shared rule, so the page and the server cannot disagree.
export function createGameSyncService(options: {
  readonly clock: () => Date;
  // Each listed game with the milestones it declares.
  readonly games: ReadonlyMap<string, ReadonlySet<string>>;
  readonly maxProgressBytes: number;
  readonly repository: GameSyncRepository;
}): GameSyncService {
  return {
    sync: async (userId, { gameId, state }) => {
      const declared = options.games.get(gameId);
      if (declared === undefined) return { kind: "unknown-game" };
      const unknown = state.milestones.find(({ id }) => !declared.has(id));
      if (unknown !== undefined)
        return { id: unknown.id, kind: "unknown-milestone" };
      if (
        state.progress !== null &&
        Buffer.byteLength(JSON.stringify(state.progress.state)) >
          options.maxProgressBytes
      )
        return { kind: "too-large" };
      const now = options.clock();
      return {
        kind: "synced",
        state: await options.repository.change(userId, gameId, (stored) =>
          mergeGameState(stored, state, now),
        ),
      };
    },
  };
}
