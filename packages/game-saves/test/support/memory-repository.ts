import { randomUUID } from "node:crypto";

import type { GameState } from "@frostbite/shared/games";

import type { GameSyncRepository } from "../../src/repository.ts";

// A stand-in for the database in service tests: the same contract, with the stored state in memory. What the
// real repository does (locking, atomic writes) is proved against PostgreSQL in the integration tests.
export function createMemoryRepository(): GameSyncRepository & {
  readonly calls: { gameId: string; userId: string }[];
} {
  const stored = new Map<string, GameState>();
  const ids = new Map<string, string>();
  const calls: { gameId: string; userId: string }[] = [];
  return {
    calls,
    change: async (userId, gameId, decide) => {
      calls.push({ gameId, userId });
      const key = `${userId}:${gameId}`;
      const next = decide(
        stored.get(key) ?? { counters: [], milestones: [], progress: null },
      );
      stored.set(key, next);
      // One id per player and game, kept: what the real row does.
      const playerId = ids.get(key) ?? randomUUID();
      ids.set(key, playerId);
      return { playerId, state: next };
    },
  };
}
