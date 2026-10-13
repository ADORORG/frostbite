import type { GameHostBackend, HostedGame } from "../src/host.ts";
import {
  gameChannel,
  protocolVersion,
  type JsonValue,
  type Response,
} from "../src/protocol.ts";

export const game: HostedGame = {
  id: "tap-tower",
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Score 5.",
      description: "Five taps.",
      id: "first-five",
      title: "First five",
    },
    {
      claimPolicy: "repeatable",
      criteria: "Score 10.",
      description: "Ten taps.",
      id: "ten-taps",
      title: "Ten taps",
    },
  ],
};

export const request = (method: string, params: unknown = {}, id = "r1") => ({
  channel: gameChannel,
  id,
  method,
  params,
  version: protocolVersion,
});

// A backend that keeps everything in memory, and can be told to fail.
export function memoryBackend(overrides: Partial<GameHostBackend> = {}) {
  let progress: JsonValue | null = null;
  const unlocked: Record<
    string,
    { unlockedAt: string; verification: "self-reported" }
  > = {};
  const backend: GameHostBackend = {
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

export const outcome = (response: Response | undefined) =>
  response === undefined ? "none" : response.ok ? "ok" : response.error.code;

// The same game once it has declared the wallet capability in its manifest.
export const walletGame: HostedGame = { ...game, capabilities: ["wallet"] };

export const taprootAddress =
  "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";
