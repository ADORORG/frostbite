import {
  mergeGameState,
  type GameState,
  type SyncGameStateInput,
} from "@ador/shared/games";

import type { GameSyncRepository } from "./repository.ts";
import {
  asReported,
  boundState,
  earnReached,
  type MilestoneRules,
} from "./rules.ts";

export type SyncOutcome =
  | {
      readonly kind: "synced";
      readonly playerId: string;
      readonly state: GameState;
    }
  | { readonly kind: "unknown-game" }
  | { readonly kind: "unknown-milestone"; readonly id: string }
  // A total reported for a milestone that has no target to reach.
  | { readonly kind: "no-target"; readonly id: string }
  | { readonly kind: "too-large" };

export interface GameSyncService {
  sync(userId: string, input: SyncGameStateInput): Promise<SyncOutcome>;
}

// Syncs a signed-in player's local state with their account. The authoritative checks are here, not in the
// page: the game must be one the platform lists, every milestone must be one that game declares, and the save
// must fit the configured size. The merge is the shared rule, so the page and the server cannot disagree.
export function createGameSyncService(options: {
  readonly clock: () => Date;
  // Each listed game with the milestones it declares and what each allows.
  readonly games: ReadonlyMap<string, MilestoneRules>;
  readonly maxProgressBytes: number;
  readonly repository: GameSyncRepository;
}): GameSyncService {
  return {
    sync: async (userId, { gameId, state }) => {
      const rules = options.games.get(gameId);
      if (rules === undefined) return { kind: "unknown-game" };
      const unknown = [...state.milestones, ...state.counters].find(
        ({ id }) => !rules.has(id),
      );
      if (unknown !== undefined)
        return { id: unknown.id, kind: "unknown-milestone" };
      const noTarget = state.counters.find(
        ({ id }) => rules.get(id)?.target === undefined,
      );
      if (noTarget !== undefined) return { id: noTarget.id, kind: "no-target" };
      if (
        state.progress !== null &&
        Buffer.byteLength(JSON.stringify(state.progress.state)) >
          options.maxProgressBytes
      )
        return { kind: "too-large" };
      const now = options.clock();
      const { playerId, state: merged } = await options.repository.change(
        userId,
        gameId,
        // Bounded on the way in and on the way out: what the game sends, and what the account holds (a manifest
        // may have lowered a limit since).
        (stored) =>
          earnReached(
            boundState(
              mergeGameState(stored, boundState(asReported(state), rules), now),
              rules,
            ),
            rules,
            now,
          ),
      );
      return { kind: "synced", playerId, state: merged };
    },
  };
}
