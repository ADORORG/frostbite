import type { GameHostBackend } from "@ador/game-sdk/host";
import type { JsonValue } from "@ador/game-sdk/protocol";

// What a player's browser would keep for a game, held in memory, and open to failing on purpose. It is the
// backend the conformance runs use, so a game is judged on how it talks to the platform and not on storage.
export function createMemoryGameBackend(
  overrides: Partial<GameHostBackend> = {},
) {
  let progress: JsonValue | null = null;
  const unlocked: Record<
    string,
    { unlockedAt: string; verification: "self-reported" }
  > = {};
  const backend: GameHostBackend = {
    identity: async () => ({ id: "memory-player-0001", kind: "local" }),
    loadProgress: async () => progress,
    milestones: async () => ({ ...unlocked }),
    player: () => ({ signedIn: false, walletConnected: false }),
    saveProgress: async (state) => {
      progress = state;
    },
    unlock: async (id, now) => {
      const existing = unlocked[id];
      if (existing !== undefined)
        return { alreadyUnlocked: true, unlockedAt: existing.unlockedAt };
      const unlockedAt = now.toISOString();
      unlocked[id] = { unlockedAt, verification: "self-reported" };
      return { alreadyUnlocked: false, unlockedAt };
    },
    ...overrides,
  };
  return { backend, unlocked };
}
