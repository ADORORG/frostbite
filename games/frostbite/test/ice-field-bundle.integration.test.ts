import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import { runRecordSchema } from "@ador/game-sdk/run-record";
import { createMemoryGameBackend } from "@ador/test-kit/memory-game-backend";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { iceFieldRules } from "../src/verifier/ice-field.ts";

// The real bundle of FROST·BITE, with the ice-field cabinet in it, played through its own DOM against a simulated
// platform: what a player clicks is what is recorded, and the record is a legal run of the platform's rules.
const root = join(import.meta.dirname, "..");
const manifest = {
  id: "frostbite",
  milestones: ["first-win", "first-glacier", "first-cashout"].map((id) => ({
    claimPolicy: "once" as const,
    criteria: id,
    description: id,
    id,
    title: id,
  })),
};
const pause = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

let running: SimulatedGame | undefined;
afterEach(() => running?.close());

async function start() {
  const memory = createMemoryGameBackend();
  running = runGameInSimulatedHost({
    backend: memory.backend,
    game: manifest,
    html: await readFile(join(root, "index.html"), "utf8"),
    script: await bundleGameScript(join(root, "src/main.ts")),
  });
  await pause(400);
  const { document } = running.window;
  const click = async (element: Element | null | undefined) => {
    element?.dispatchEvent(
      new running!.window.MouseEvent("click", { bubbles: true }),
    );
    await pause();
  };
  const buttonNamed = (name: string) =>
    [...document.querySelectorAll("button")].find((candidate) =>
      candidate.textContent.includes(name),
    );
  return { buttonNamed, click, document, memory };
}

describe("the ice-field cabinet in the bundled game", () => {
  it("is on the page beside the game, in a root of its own, and the game still draws", async () => {
    const { document } = await start();
    expect(document.getElementById("root")?.children.length).toBeGreaterThan(0);
    expect(document.getElementById("ice-field-root")?.textContent).toBe(
      "Ice field",
    );
  });

  it("plays a board, tells the platform the milestone it earned, and leaves a record that is a legal run", async () => {
    const { buttonNamed, click, document, memory } = await start();
    await click(buttonNamed("Ice field"));
    await click(buttonNamed("Start a run"));
    // The seed is random, so pick tiles until a board is won: a mine ends a board, a safe pick can be settled as a win.
    for (
      let board = 0;
      board < 40 && memory.unlocked["first-win"] === undefined;
      board += 1
    ) {
      await click(document.querySelector(".if-tile:not(:disabled)"));
      await click(buttonNamed("Settle board"));
    }
    expect(Object.keys(memory.unlocked)).toContain("first-win");
    expect(running?.events.filter(({ type }) => type === "refused")).toEqual(
      [],
    );

    await click(buttonNamed("End run"));
    const text =
      document.querySelector<HTMLTextAreaElement>(".if-record-text")?.value ??
      "";
    const record = runRecordSchema.parse(JSON.parse(text));
    expect(record.claims).toEqual(["first-win"]);
    expect(record.gameId).toBe("frostbite");

    const started = iceFieldRules.init(record.seed, record.config);
    if (!started.ok) throw new Error(started.reason);
    let state = started.state;
    for (const input of record.inputs) {
      const stepped = iceFieldRules.step(state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped.state;
    }
    expect(iceFieldRules.earned(state)).toEqual(record.claims);
  });

  it("does not report first-cashout, which only the game's own simulation can reach", async () => {
    const { buttonNamed, click, memory } = await start();
    await click(buttonNamed("Ice field"));
    await click(buttonNamed("Start a run"));
    await click(buttonNamed("End run"));
    expect(Object.keys(memory.unlocked)).not.toContain("first-cashout");
  });
});
