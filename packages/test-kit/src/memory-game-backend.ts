import type { GameHostBackend } from "@frostbite/game-sdk/host";
import type { JsonValue } from "@frostbite/game-sdk/protocol";

// What a player's browser would keep for a game, held in memory, and open to failing on purpose. It is the
// backend the conformance runs use, so a game is judged on how it talks to the platform and not on storage.
export function createMemoryGameBackend(
  overrides: Partial<GameHostBackend> = {},
) {
  let progress: JsonValue | null = null;
  const unlocked: Record<
    string,
    { count: number; unlockedAt: string; verification: "self-reported" }
  > = {};
  const totals: Record<string, number> = {};
  const backend: GameHostBackend = {
    counters: async () => ({ ...totals }),
    identity: async () => ({ id: "memory-player-0001", kind: "local" }),
    loadProgress: async () => progress,
    milestones: async () => ({ ...unlocked }),
    player: () => ({ signedIn: false, walletConnected: false }),
    reportProgress: async (id, current, target, now) => {
      const held = Math.min(Math.max(totals[id] ?? 0, current), target);
      totals[id] = held;
      const existing = unlocked[id];
      if (existing !== undefined || held < target)
        return {
          current: held,
          newlyUnlocked: false,
          unlockedAt: existing?.unlockedAt ?? null,
        };
      const unlockedAt = now.toISOString();
      unlocked[id] = { count: 1, unlockedAt, verification: "self-reported" };
      return { current: held, newlyUnlocked: true, unlockedAt };
    },
    saveProgress: async (state) => {
      progress = state;
    },
    unlock: async (id, now, max) => {
      const existing = unlocked[id];
      if (existing !== undefined) {
        const counted = existing.count < max;
        if (counted) existing.count += 1;
        return {
          alreadyUnlocked: true,
          count: existing.count,
          counted,
          unlockedAt: existing.unlockedAt,
        };
      }
      const unlockedAt = now.toISOString();
      unlocked[id] = { count: 1, unlockedAt, verification: "self-reported" };
      return { alreadyUnlocked: false, count: 1, counted: false, unlockedAt };
    },
    ...overrides,
  };
  return { backend, totals, unlocked };
}
