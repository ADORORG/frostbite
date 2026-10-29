import { replayRecord } from "@ador/game-sdk/replay";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import { runRecordSchema } from "@ador/game-sdk/run-record";
import type { HostServices } from "@ador/game-sdk/host";
import { createMemoryGameBackend } from "@ador/test-kit/memory-game-backend";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { frostbiteRules } from "../src/verifier/frostbite.ts";

// The real bundle of FROST·BITE, with the ice-field cabinet in it, played through its own DOM against a simulated
// platform: what a player clicks is what is recorded, and the record is a legal run of the platform's rules.
const root = join(import.meta.dirname, "..");
const manifest = {
  // Granted as the platform grants it; the page offers no runs here, so the cabinet falls back to a local seed.
  capabilities: ["run:submit"],
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

async function start(services?: HostServices) {
  const memory = createMemoryGameBackend();
  running = runGameInSimulatedHost({
    backend: memory.backend,
    game: manifest,
    html: await readFile(join(root, "index.html"), "utf8"),
    script: await bundleGameScript(join(root, "src/main.ts")),
    services,
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

    expect(replayRecord(frostbiteRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
  });

  it("does not report first-cashout, which only the game's own simulation can reach", async () => {
    const { buttonNamed, click, memory } = await start();
    await click(buttonNamed("Ice field"));
    await click(buttonNamed("Start a run"));
    await click(buttonNamed("End run"));
    expect(Object.keys(memory.unlocked)).not.toContain("first-cashout");
  });

  it("is played on the platform's seed when the page gives a run, and sends the record it leaves for that run", async () => {
    const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
    const submitted: { record: unknown; runId: string }[] = [];
    const { buttonNamed, click, document } = await start({
      runs: {
        start: async () => ({
          expiresAt: "2026-10-16T12:00:00.000Z",
          runId,
          seed: 4_000_000_000,
          status: "started",
        }),
        submit: async (id, record) => {
          submitted.push({ record, runId: id });
          return { earned: [], status: "verified" };
        },
      },
    });
    await click(buttonNamed("Ice field"));
    await click(buttonNamed("Start a run"));
    await click(buttonNamed("End run"));
    const text =
      document.querySelector<HTMLTextAreaElement>(".if-record-text")?.value ??
      "";
    expect(runRecordSchema.parse(JSON.parse(text)).seed).toBe(4_000_000_000);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.runId).toBe(runId);
    expect(runRecordSchema.parse(submitted[0]?.record)).toMatchObject({
      gameId: "frostbite",
      seed: 4_000_000_000,
    });
    expect(document.querySelector(".if-note")?.textContent).toContain(
      "The platform checked this run.",
    );
  });

  it("is played on a local seed, and says so, when the page offers no runs", async () => {
    const { buttonNamed, click, document } = await start();
    await click(buttonNamed("Ice field"));
    await click(buttonNamed("Start a run"));
    expect(document.querySelector(".if-status")?.textContent).toContain(
      "The platform cannot check runs here.",
    );
  });
});
