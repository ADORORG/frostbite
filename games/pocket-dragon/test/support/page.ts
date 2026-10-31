import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import type { RunsService } from "@ador/game-sdk/host";
import { defaultGameHostPolicy } from "@ador/game-sdk/policy";
import type { JsonValue } from "@ador/game-sdk/protocol";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";

import { milestoneIds } from "../../src/rules/milestones.ts";

// The game's page, bundled once and run against a simulated platform that keeps what the game saves and unlocks, and (when asked) hands
// out runs and replays what is sent back.
const root = join(import.meta.dirname, "../..");
const milestone = (id: string) => ({
  claimPolicy: "once" as const,
  criteria: id,
  description: id,
  id,
  title: `Title of ${id}`,
});
const manifest = {
  capabilities: ["milestone:claim", "run:submit"],
  id: "pocket-dragon",
  milestones: milestoneIds.map(milestone),
};

export const settle = (ms = 60) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type Backend = Parameters<typeof runGameInSimulatedHost>[0]["backend"];

let running: SimulatedGame | undefined;
export const closeGame = (): void => running?.close();

let built: Promise<{ html: string; script: string }> | undefined;
const page = () =>
  (built ??= Promise.all([
    readFile(join(root, "index.html"), "utf8"),
    bundleGameScript(join(root, "src/main.ts")),
  ]).then(([html, script]) => ({ html, script })));

export async function play(
  saved: JsonValue | null = null,
  answers: Partial<Backend> = {},
  runs?: RunsService,
) {
  const stored: {
    progress: JsonValue | null;
    unlocked: Record<string, string>;
  } = { progress: saved, unlocked: {} };
  const { html, script } = await page();
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
      player: () => ({ signedIn: true, walletConnected: false }),
      reportProgress: async () => ({
        current: 0,
        newlyUnlocked: false,
        unlockedAt: null,
      }),
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
    services: runs === undefined ? undefined : { runs },
  });
  const { window } = running;
  const byId = (id: string) => window.document.getElementById(id);
  return {
    byId,
    click: (id: string) =>
      byId(id)?.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true }),
      ),
    press: (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code })),
    release: (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keyup", { code })),
    running: () => byId("start")?.hasAttribute("hidden") === true,
    stored,
    text: (id: string) => byId(id)?.textContent,
    window,
  };
}

// Waits while a run goes on, a tenth of a second at a time, for at most `most` tenths.
export async function whileRunning(
  game: Awaited<ReturnType<typeof play>>,
  most: number,
): Promise<void> {
  for (let at = 0; at < most && game.running(); at += 1) await settle(100);
}
