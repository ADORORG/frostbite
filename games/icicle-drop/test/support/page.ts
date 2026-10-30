import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import { defaultGameHostPolicy } from "@ador/game-sdk/policy";
import type { JsonValue } from "@ador/game-sdk/protocol";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";

import { milestoneIds } from "../../src/rules/milestones.ts";

// Icicle Drop's page, bundled and run against a simulated platform that keeps what the game saves and unlocks.
const root = join(import.meta.dirname, "../..");
const milestone = (id: string, title: string) => ({
  claimPolicy: "once" as const,
  criteria: title,
  description: title,
  id,
  title,
});
const manifest = {
  id: "icicle-drop",
  milestones: milestoneIds.map((id) => milestone(id, id)),
};

export const settle = (ms = 60) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type Backend = Parameters<typeof runGameInSimulatedHost>[0]["backend"];

let running: SimulatedGame | undefined;
export const closeGame = (): void => running?.close();

export async function play(
  saved?: { best: number; sound?: JsonValue },
  answers: Partial<Backend> = {},
) {
  const stored: {
    progress: JsonValue | null;
    unlocked: Record<string, string>;
  } = {
    progress: saved === undefined ? null : { ...saved },
    unlocked: {},
  };
  const html = await readFile(join(root, "index.html"), "utf8");
  const script = await bundleGameScript(join(root, "src/main.ts"));
  running = runGameInSimulatedHost({
    backend: {
      counters: async () => ({}),
      identity: async () => ({ id: "sample-player-0001", kind: "local" }),
      loadProgress: async () => stored.progress,
      reportProgress: async () => ({
        current: 0,
        newlyUnlocked: false,
        unlockedAt: null,
      }),
      milestones: async () =>
        Object.fromEntries(
          Object.entries(stored.unlocked).map(([id, unlockedAt]) => [
            id,
            { count: 1, unlockedAt, verification: "self-reported" as const },
          ]),
        ),
      player: () => ({ signedIn: false, walletConnected: false }),
      saveProgress: async (value) => void (stored.progress = value),
      unlock: async (id, now) => {
        const already = stored.unlocked[id];
        stored.unlocked[id] ??= now.toISOString();
        return {
          alreadyUnlocked: already !== undefined,
          count: 1,
          counted: false,
          unlockedAt: stored.unlocked[id] ?? "",
        };
      },
      ...answers,
    },
    game: manifest,
    html,
    policy: {
      ...defaultGameHostPolicy,
      saveCallsPerMinute: 600,
      unlockCallsPerMinute: 600,
    },
    script,
  });
  return { stored, window: running.window };
}
