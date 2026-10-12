import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bundleGameScript } from "@ador/game-sdk/build";

import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "../src/simulated-game-host.ts";
import { game, memoryBackend } from "./support/game-host.ts";

const mini = join(import.meta.dirname, "fixtures/mini-game");
let running: SimulatedGame | undefined;
afterEach(() => running?.close());
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

describe("a game built with the SDK, run against a simulated host", () => {
  it("connects, saves, unlocks a milestone and reads its state, with no storage and no network of its own", async () => {
    const script = await bundleGameScript(join(mini, "src/main.ts"));
    const memory = memoryBackend();
    running = runGameInSimulatedHost({
      backend: memory.backend,
      game,
      html: '<!doctype html><body><p id="out">waiting</p></body>',
      script,
    });
    await settle();
    expect(running.window.document.getElementById("out")?.textContent).toBe(
      "done 1 false",
    );
    expect(await memory.backend.loadProgress()).toEqual({ visits: 1 });
    expect(Object.keys(memory.unlocked)).toEqual(["first-five"]);
    expect(running.replies.every((reply) => reply.ok)).toBe(true);
    expect(running.events.map(({ type }) => type)).toEqual([
      "ready",
      "progress-saved",
      "milestone-unlocked",
    ]);
  });

  it("picks up from the progress it saved the last time", async () => {
    const script = await bundleGameScript(join(mini, "src/main.ts"));
    const memory = memoryBackend();
    await memory.backend.saveProgress({ visits: 4 }, new Date());
    running = runGameInSimulatedHost({
      backend: memory.backend,
      game,
      html: '<!doctype html><body><p id="out"></p></body>',
      script,
    });
    await settle();
    expect(await memory.backend.loadProgress()).toEqual({ visits: 5 });
  });

  it("shows what it was told when the platform refuses, instead of hanging", async () => {
    const script = await bundleGameScript(join(mini, "src/main.ts"));
    const memory = memoryBackend({
      unlock: async () => {
        throw new Error("down");
      },
    });
    running = runGameInSimulatedHost({
      backend: memory.backend,
      game,
      html: '<!doctype html><body><p id="out"></p></body>',
      script,
    });
    await settle();
    expect(running.window.document.getElementById("out")?.textContent).toBe(
      "failed The platform could not do that.",
    );
  });

  it("is cut off the way the isolated frame is: no storage, no fetch, no request object", async () => {
    running = runGameInSimulatedHost({
      backend: memoryBackend().backend,
      game,
      html: '<!doctype html><body><p id="out"></p></body>',
      script: `
        const results = [];
        for (const name of ["localStorage", "sessionStorage", "fetch", "XMLHttpRequest"]) {
          try { void window[name]; results.push(name + ": allowed"); } catch { results.push(name + ": blocked"); }
        }
        document.getElementById("out").textContent = results.join(",");
      `,
    });
    expect(running.window.document.getElementById("out")?.textContent).toBe(
      "localStorage: blocked,sessionStorage: blocked,fetch: blocked,XMLHttpRequest: blocked",
    );
  });
});
