import { join } from "node:path";

import { bundleGameScript } from "@frostbite/game-sdk/build";
import { defaultGameHostPolicy } from "@frostbite/game-sdk/policy";
import { createMemoryGameBackend } from "@frostbite/test-kit/memory-game-backend";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@frostbite/test-kit/simulated-game-host";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const manifest = {
  id: "frostbite",
  milestones: ["first-win", "first-cashout"].map((id) => ({
    claimPolicy: "once" as const,
    criteria: id,
    description: id,
    id,
    title: id,
  })),
};
const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

let running: SimulatedGame | undefined;
afterEach(() => running?.close());

async function play(saved?: object) {
  const memory = createMemoryGameBackend();
  if (saved !== undefined)
    await memory.backend.saveProgress(saved as never, new Date());
  running = runGameInSimulatedHost({
    backend: memory.backend,
    game: manifest,
    html: await readFile(join(root, "index.html"), "utf8"),
    policy: defaultGameHostPolicy,
    script: await bundleGameScript(join(root, "src/main.ts")),
  });
  await settle();
  return {
    memory,
    window: running.window as unknown as Window & {
      FrostbiteHost: { milestone(k: string): void };
    },
  };
}

describe("FROST·BITE bundled and run against a simulated platform", () => {
  it("starts, draws the game, and gives it a storage in place of the one the frame lacks", async () => {
    const { window } = await play();
    expect(running?.events.map(({ type }) => type)).toContain("ready");
    expect(
      window.document.getElementById("root")?.children.length,
    ).toBeGreaterThan(0);
    window.localStorage.setItem("frostbite.levels.v1", '{"sats":2}');
    expect(window.localStorage.getItem("frostbite.levels.v1")).toBe(
      '{"sats":2}',
    );
  });

  it("starts from what the platform saved last time", async () => {
    const { window } = await play({
      storage: { "frostbite.levels.v1": '{"sats":5}', stray: "ignored" },
    });
    expect(window.localStorage.getItem("frostbite.levels.v1")).toBe(
      '{"sats":5}',
    );
    expect(window.localStorage.getItem("stray")).toBeNull();
  });

  it("reports a mark the manifest declares and no other", async () => {
    const { window, memory } = await play();
    window.FrostbiteHost.milestone("firstWin");
    window.FrostbiteHost.milestone("firstBust");
    await settle(100);
    expect(Object.keys(memory.unlocked)).toEqual(["first-win"]);
    expect(running?.events.filter(({ type }) => type === "refused")).toEqual(
      [],
    );
  });

  it("plays on, nothing kept, when no platform answers", async () => {
    running = runGameInSimulatedHost({
      backend: createMemoryGameBackend({
        loadProgress: async () => {
          throw new Error("no host");
        },
      }).backend,
      game: manifest,
      html: await readFile(join(root, "index.html"), "utf8"),
      script: await bundleGameScript(join(root, "src/main.ts")),
    });
    await settle();
    expect(
      running.window.document.getElementById("root")?.children.length,
    ).toBeGreaterThan(0);
  });
});
