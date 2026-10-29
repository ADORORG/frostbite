import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import type { JsonValue } from "@ador/game-sdk/protocol";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";
import { defaultGameHostPolicy } from "@ador/game-sdk/policy";

import { milestoneIds } from "../src/rules/milestones.ts";
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
  id: "icicle-drop",
  milestones: milestoneIds.map((id) => milestone(id, id)),
};
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

describe("Icicle Drop, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(window.document.getElementById("status")?.textContent).toBe(
      "Connected.",
    );
    expect(
      window.document.getElementById("start")?.hasAttribute("disabled"),
    ).toBe(false);
    for (const button of window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 4321 });
    await settle();
    expect(window.document.getElementById("best")?.textContent).toBe("4321");
  });

  it("starts a run on a seed of its own, says the run is its own report, and moves the tiles", async () => {
    const { window } = await play({ best: 0 });
    await settle();
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(window.document.getElementById("note")?.textContent).toContain(
      "local seed",
    );
    const tiles = () =>
      [...window.document.querySelectorAll("#board .tile")].map(
        (tile) => tile.textContent,
      );
    expect(tiles().filter((text) => text !== "")).toHaveLength(2);
    // Press each direction until one moves the tiles: the board is random, so one of them may change nothing.
    for (const direction of ["left", "down", "right", "up"])
      window.document
        .querySelector(`#pad [data-direction="${direction}"]`)
        ?.dispatchEvent(new window.MouseEvent("click"));
    expect(
      Number(window.document.getElementById("moves")?.textContent),
    ).toBeGreaterThan(0);
    expect(tiles().filter((text) => text !== "").length).toBeGreaterThan(2);
  });

  it("moves the tiles from the keyboard, and a run ends with a note about what the platform could not check", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    // Play until no move is left: a corner-hugging order gets a run to an end well inside the limit.
    for (let at = 0; at < 3_000; at += 1) {
      const code = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"][at % 4];
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
      if (
        window.document
          .getElementById("note")
          ?.textContent?.includes("your own claim")
      )
        break;
    }
    await settle(100);
    expect(window.document.getElementById("note")?.textContent).toContain(
      "your own claim",
    );
    expect(stored.progress).toEqual({ best: expect.any(Number) });
  }, 20_000);

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
