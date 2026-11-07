import type { RunsService } from "@frostbite/game-sdk/host";
import type { RunRecord } from "@frostbite/game-sdk/run-record";
import { afterEach, describe, expect, it } from "vitest";

import { nurseryOverNote } from "../src/bonus/nursery-run.ts";
import type { PlayId } from "../src/rules/constants.ts";
import { adminKey } from "../src/test-mode/key.ts";
import {
  closeGame,
  fastFrames,
  play,
  settle,
  whileRunning,
} from "./support/page.ts";

afterEach(closeGame);

// What the platform was asked for: each run it gave (with its id and seed) and each record sent back, under the id it was sent with.
function recordingRuns(seed: number) {
  const started: string[] = [];
  const submitted: { record: RunRecord; runId: string }[] = [];
  const runs: RunsService = {
    start: async () => {
      const runId = `run-${String(started.length + 1)}`;
      started.push(runId);
      return {
        expiresAt: "2026-11-30T23:00:00.000Z",
        runId,
        seed,
        status: "started",
      };
    },
    submit: async (runId, record) => {
      submitted.push({ record: record as RunRecord, runId });
      return { earned: [], status: "verified" };
    },
  };
  return { runs, started, submitted };
}

const allOpen = {
  best: { castle: 0, hills: 0, quest: 0, woods: 0 },
  fame: [],
  plasma: 0,
  sound: { effects: false, music: false, volume: 0.2 },
  unlocked: 3,
  won: true,
};
// A seed on which running right loses Egg Hills in under nine seconds; the castle and the woods run to their fifteen minutes.
const quickLoss = 6;
const keyOf: Readonly<Record<PlayId, string>> = {
  castle: "Digit2",
  hills: "Digit1",
  quest: "Digit0",
  woods: "Digit3",
};

describe("a finished run on the platform", () => {
  for (const id of ["quest", "hills", "castle", "woods"] as const)
    it(`is sent once, under the platform's run and on its seed: ${id}`, async () => {
      const platform = recordingRuns(quickLoss);
      const game = await play(allOpen, {}, platform.runs);
      await settle();
      fastFrames(game);
      game.press(keyOf[id]);
      game.press("Enter");
      await settle(30);
      game.press("ArrowRight");
      await whileRunning(game, 300);
      expect(game.running()).toBe(false);
      await settle(100);
      expect(platform.started).toEqual(["run-1"]);
      expect(platform.submitted).toHaveLength(1);
      expect(platform.submitted[0]?.runId).toBe("run-1");
      expect(platform.submitted[0]?.record).toMatchObject({
        config: { cabinet: id },
        seed: quickLoss,
      });
      if (id !== "hills") return;
      // The next run is a run of its own, sent under its own id.
      game.release("ArrowRight");
      game.press("Enter");
      await settle(30);
      game.press("ArrowRight");
      await whileRunning(game, 300);
      await settle(100);
      expect(platform.started).toEqual(["run-1", "run-2"]);
      expect(platform.submitted.map(({ runId }) => runId)).toEqual([
        "run-1",
        "run-2",
      ]);
    }, 60_000);
});

// The browser's WebCrypto, made to say that whatever key is typed is the admin's, so the page's test mode can be opened here.
function trustEveryKey(game: Awaited<ReturnType<typeof play>>): void {
  const hash = Uint8Array.from(adminKey.hash.match(/../gu) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
  Object.defineProperty(game.window, "crypto", {
    configurable: true,
    value: {
      subtle: {
        deriveBits: async () => hash.buffer,
        importKey: async () => ({}),
      },
    },
  });
}

describe("what is never sent", () => {
  it("is a test run: the platform is asked for no run, and nothing is sent when it is left", async () => {
    const platform = recordingRuns(quickLoss);
    const game = await play(allOpen, {}, platform.runs);
    await settle();
    trustEveryKey(game);
    game
      .byId("title")
      ?.dispatchEvent(
        new game.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    await settle(2_100);
    const input = game.byId("test-key");
    if (!(input instanceof game.window.HTMLInputElement))
      throw new Error("no key field");
    input.value = "ANY-KEY";
    game.click("test-unlock");
    for (let wait = 0; wait < 20 && game.byId("test-badge")?.hidden; wait += 1)
      await settle(50);
    expect(game.byId("test-badge")?.hidden).toBe(false);
    fastFrames(game);
    game.press("Digit1");
    game.press("Enter");
    await settle(30);
    game.press("ArrowRight");
    await settle(300);
    expect(game.running()).toBe(true);
    game.click("test-leave");
    await settle(100);
    expect(game.running()).toBe(false);
    expect(platform.started).toEqual([]);
    expect(platform.submitted).toEqual([]);
  }, 20_000);

  it("is a visit to the Sky Nursery, even after a run that was sent: no run is asked for, nothing is sent or saved", async () => {
    const platform = recordingRuns(quickLoss);
    const game = await play(allOpen, {}, platform.runs);
    await settle();
    fastFrames(game);
    game.press("Digit1");
    game.press("Enter");
    await settle(30);
    game.press("ArrowRight");
    await whileRunning(game, 300);
    await settle(100);
    game.release("ArrowRight");
    expect(platform.submitted.map(({ runId }) => runId)).toEqual(["run-1"]);
    const saved = game.stored.progress;
    game.press("Digit4");
    await settle(30);
    expect(game.running()).toBe(true);
    game.press("ArrowRight");
    await whileRunning(game, 100);
    expect(game.running()).toBe(false);
    await settle(100);
    expect(game.text("note")).toBe(nurseryOverNote);
    expect(platform.started).toEqual(["run-1"]);
    expect(platform.submitted.map(({ runId }) => runId)).toEqual(["run-1"]);
    expect(game.stored.progress).toEqual(saved);
  }, 20_000);
});
