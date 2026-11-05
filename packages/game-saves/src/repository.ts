import type { GameState } from "@frostbite/shared/games";

// Where a player's saved state for a game lives. `change` is the only write: it hands the stored state to
// `decide` while holding the player's rows for that game, stores what `decide` returns, and returns it, so
// two syncs of one player and game cannot interleave and a lost update is impossible. The answer also carries the
// player's id for the game, which the row has from the first sync and keeps.
export interface GameSyncRepository {
  change(
    userId: string,
    gameId: string,
    decide: (stored: GameState) => GameState,
  ): Promise<{ readonly playerId: string; readonly state: GameState }>;
}
