import type { RunRecord } from "@frostbite/game-sdk/run-record";
import { restartDelayMs } from "@frostbite/game-sdk/touch-start";
import { afterEach, describe, expect, it } from "vitest";

import { stickMiddle } from "../src/page/thumbs.ts";
import {
  closeGame,
  play,
  settle,
  thumbs,
  whileRunning,
} from "./support/page.ts";

afterEach(closeGame);

// A seed on which running right loses Egg Hills in under nine seconds.
const quickLoss = 6;

describe("Pocket Dragon played with thumbs on a touch screen", () => {
  it("starts with a tap, runs right with a thumb on the stick, and sends the run once when it ends", async () => {
    const sent: { record: RunRecord; runId: string }[] = [];
    const game = await play(
      null,
      {},
      {
        start: async () => ({
          expiresAt: "2026-11-30T23:00:00.000Z",
          runId: "run-thumbs",
          seed: quickLoss,
          status: "started",
        }),
        submit: async (runId, record) => {
          sent.push({ record: record as RunRecord, runId });
          return { earned: [], status: "verified" };
        },
      },
    );
    const finger = thumbs(game);
    const tap = (id: number) => {
      finger("pointerdown", id, 300, 400);
      finger("pointerup", id, 300, 400);
      finger("click", id, 300, 400);
    };
    // A tap starts a run once Start has been on offer for a moment (the SDK's `attachTapToStart`).
    await settle();
    tap(1);
    await settle(100);
    expect(game.running()).toBe(false);
    await settle(restartDelayMs);
    tap(1);
    await settle(100);
    expect(game.running()).toBe(true);
    expect(game.text("note")).toBe(
      "Three levels on one clock: your hearts and your backpack carry on.",
    );
    const middle = stickMiddle(390, 470);
    finger("pointerdown", 2, middle.x + 60, middle.y);
    await whileRunning(game, 200);
    expect(game.running()).toBe(false);
    await settle(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.runId).toBe("run-thumbs");
    expect(sent[0]?.record.seed).toBe(quickLoss);
    // Running right on this seed is what loses Egg Hills so soon.
    expect(sent[0]?.record.inputs.length).toBeGreaterThan(0);
    expect(game.text("stat-1")).toBe("0");
    expect(game.text("note")).toBe("The quest ended in Egg Hills.");
    // The thumb still down as the run ended, lifted after it, does not start the next one, nor does a tap straight after; a tap once the
    // card after the run has been seen for a moment does.
    finger("pointerup", 2, middle.x + 60, middle.y);
    tap(3);
    await settle(100);
    expect(game.running()).toBe(false);
    await settle(restartDelayMs);
    tap(4);
    await settle(100);
    expect(game.running()).toBe(true);
  }, 40_000);
});
