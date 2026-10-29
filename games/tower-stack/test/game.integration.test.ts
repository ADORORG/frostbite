import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import { defaultGameHostPolicy } from "@ador/game-sdk/policy";
import type { JsonValue } from "@ador/game-sdk/protocol";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { milestoneIds } from "../src/rules/milestones.ts";

const root = join(import.meta.dirname, "..");
const milestone = (id: string) => ({
  claimPolicy: "once" as const,
  criteria: id,
  description: id,
  id,
  title: id,
});
const manifest = { id: "tower-stack", milestones: milestoneIds.map(milestone) };
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

let running: SimulatedGame | undefined;
afterEach(() => running?.close());

async function play(saved?: { best: number }) {
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
      milestones: async () => ({}),
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

type GameWindow = Awaited<ReturnType<typeof play>>["window"];
const byId = (window: GameWindow, id: string) =>
  window.document.getElementById(id);

describe("Tower Stacker, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(byId(window, "status")?.textContent).toBe("Connected.");
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "drop")?.hasAttribute("disabled")).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 41 });
    await settle();
    expect(byId(window, "best")?.textContent).toBe("41");
  });

  it("starts a run on a seed of its own, says the run is its own report, and runs until a drop misses", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "note")?.textContent).toContain("local seed");
    expect(byId(window, "drop")?.hasAttribute("disabled")).toBe(false);
    // Dropping on whatever tick the click lands on, the tower narrows until a drop misses it.
    for (
      let at = 0;
      at < 400 && byId(window, "start")?.hasAttribute("hidden");
      at += 1
    ) {
      byId(window, "drop")?.dispatchEvent(new window.MouseEvent("click"));
      await settle(35);
    }
    const start = byId(window, "start");
    expect(start?.textContent).toBe("Run again");
    expect(start?.hasAttribute("hidden")).toBe(false);
    expect(byId(window, "note")?.textContent).toContain("your own claim");
    expect(stored.progress).toEqual({ best: expect.any(Number) });
    expect(Number(byId(window, "height")?.textContent)).toBeGreaterThan(0);
  }, 40_000);

  it("says so when the platform does not answer, and can still be played", async () => {
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
    expect(
      running.window.document.getElementById("start")?.hasAttribute("disabled"),
    ).toBe(false);
  });
});
