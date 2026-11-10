import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@frostbite/game-sdk/build";
import type { HostServices } from "@frostbite/game-sdk/host";
import { defaultGameHostPolicy } from "@frostbite/game-sdk/policy";
import type { JsonValue } from "@frostbite/game-sdk/protocol";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@frostbite/test-kit/simulated-game-host";

import { milestones } from "../../src/rules/milestones.ts";

// Frost Run's page, bundled and run against a simulated platform that keeps what the game saves and unlocks. The bundle is made once for
// a file of tests: it carries three.js and the packed models, so it is not small. `fast` plays five ticks a frame, so a run can be
// played to its end inside a test.
const root = join(import.meta.dirname, "../..");
const manifest = {
  capabilities: ["milestone:claim", "run:submit"],
  id: "frost-run",
  milestones: milestones.map(({ description, id, name }) => ({
    claimPolicy: "once" as const,
    criteria: description,
    description,
    id,
    title: name,
  })),
};
let bundled: Promise<string> | null = null;

export const settle = (ms = 60) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type Backend = Parameters<typeof runGameInSimulatedHost>[0]["backend"];

let running: SimulatedGame | undefined;
export const closeGame = (): void => running?.close();

export async function play(
  saved?: { best: number; sound?: JsonValue },
  answers: Partial<Backend> = {},
  services: HostServices = {},
  fast = false,
) {
  const stored: {
    progress: JsonValue | null;
    saves: number;
    unlocked: Record<string, string>;
  } = {
    progress: saved === undefined ? null : { ...saved },
    saves: 0,
    unlocked: {},
  };
  const page = await readFile(join(root, "index.html"), "utf8");
  const html = fast
    ? page.replace('<html lang="en">', '<html lang="en" data-fixed="5">')
    : page;
  bundled ??= bundleGameScript(join(root, "src/main.ts"));
  running = runGameInSimulatedHost({
    backend: {
      counters: async () => ({}),
      identity: async () => ({ id: "sample-player-0001", kind: "local" }),
      loadProgress: async () => stored.progress,
      milestones: async () =>
        Object.fromEntries(
          Object.entries(stored.unlocked).map(([id, unlockedAt]) => [
            id,
            { count: 1, unlockedAt, verification: "self-reported" as const },
          ]),
        ),
      player: () => ({ signedIn: false, walletConnected: false }),
      reportProgress: async () => ({
        current: 0,
        newlyUnlocked: false,
        unlockedAt: null,
      }),
      saveProgress: async (value) => {
        stored.progress = value;
        stored.saves += 1;
      },
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
    script: await bundled,
    services,
  });
  return { events: running.events, stored, window: running.window };
}

export type GameWindow = Awaited<ReturnType<typeof play>>["window"];
export const byId = (window: GameWindow, id: string) =>
  window.document.getElementById(id);

// Waits, a little at a time, until `done` says so (or gives up after `ms`).
export async function until(done: () => boolean, ms = 60_000): Promise<void> {
  for (let waited = 0; waited < ms && !done(); waited += 50) await settle(50);
}
