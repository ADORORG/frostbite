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
      maxCount: 100,
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
    { count: number; unlockedAt: string; verification: "self-reported" }
  > = {};
  const totals: Record<string, number> = {};
  const backend: GameHostBackend = {
    counters: async () => ({ ...totals }),
    identity: async () => ({ id: "local-0001-test", kind: "local" }),
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

export const outcome = (response: Response | undefined) =>
  response === undefined ? "none" : response.ok ? "ok" : response.error.code;

// The same game once it has declared the wallet capability in its manifest.
export const walletGame: HostedGame = { ...game, capabilities: ["wallet"] };

export const taprootAddress =
  "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";
