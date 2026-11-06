import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@frostbite/game-sdk/build";
import type { JsonValue } from "@frostbite/game-sdk/protocol";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@frostbite/test-kit/simulated-game-host";
import { defaultGameHostPolicy } from "@frostbite/game-sdk/policy";
import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const milestone = (id: string, title: string) => ({
  claimPolicy: "once" as const,
  criteria: title,
  description: title,
  id,
  title,
});
const manifest = {
  id: "fixture-taps",
  milestones: [
    milestone("first-five", "First five"),
    milestone("ten-taps", "Ten taps"),
  ],
};
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

let running: SimulatedGame | undefined;
afterEach(() => running?.close());

async function play(saved?: { score: number }) {
  const stored: {
    progress: JsonValue | null;
    unlocked: Record<string, string>;
  } = {
    progress: saved ?? null,
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

describe("Tap Counter, bundled and run against a simulated platform", () => {
  it("connects, and lets the player tap only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(window.document.getElementById("status")?.textContent).toBe(
      "Connected. Tap to score.",
    );
    expect(
      window.document.getElementById("tap")?.hasAttribute("disabled"),
    ).toBe(false);
  });

  it("carries on from the progress the platform hands back", async () => {
    const { window } = await play({ score: 7 });
    await settle();
    expect(window.document.getElementById("score")?.textContent).toBe("7");
  });

  it("unlocks a milestone through the platform, and lists it", async () => {
    const { stored, window } = await play({ score: 4 });
    await settle();
    window.document
      .getElementById("tap")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle();
    expect(Object.keys(stored.unlocked)).toEqual(["first-five"]);
    expect(
      [...window.document.querySelectorAll("#unlocked li")].map(
        (li) => li.textContent,
      ),
    ).toEqual(["First five"]);
  });

  it("saves the score a moment after tapping, in one call", async () => {
    const { stored, window } = await play({ score: 1 });
    await settle();
    const button = window.document.getElementById("tap");
    for (let i = 0; i < 3; i += 1)
      button?.dispatchEvent(new window.MouseEvent("click"));
    await settle(1_150);
    expect(stored.progress).toEqual({ score: 4 });
    expect(
      running?.events.filter(({ type }) => type === "progress-saved"),
    ).toHaveLength(1);
  });

  it("reports that it is cut off when it probes for the network, storage and cookies", async () => {
    const { window } = await play();
    await settle();
    window.document
      .getElementById("probe")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle();
    expect(window.document.getElementById("probe-result")?.textContent).toBe(
      "fetch: blocked\nlocalStorage: blocked\ncookie: allowed",
    );
  });

  it("says so when the platform does not answer", async () => {
    const html = await readFile(join(root, "index.html"), "utf8");
    const script = await bundleGameScript(join(root, "src/main.ts"));
    running = runGameInSimulatedHost({
      backend: {
        counters: async () => ({}),
        identity: async () => ({ id: "sample-player-0001", kind: "local" }),
        reportProgress: async () => ({
          current: 0,
          newlyUnlocked: false,
          unlockedAt: null,
        }),
        loadProgress: async () => {
          throw new Error("down");
        },
        milestones: async () => ({}),
        player: () => ({ signedIn: false, walletConnected: false }),
        saveProgress: async () => undefined,
        unlock: async () => ({
          alreadyUnlocked: false,
          count: 1,
          counted: false,
          unlockedAt: "",
        }),
      },
      game: manifest,
      html,
      script,
    });
    await settle();
    expect(running.window.document.getElementById("status")?.textContent).toBe(
      "The platform said: unavailable",
    );
  });
});
