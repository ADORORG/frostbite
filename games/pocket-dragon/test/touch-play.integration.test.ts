import type { RunRecord } from "@ador/game-sdk/run-record";
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
    await settle();
    const finger = thumbs(game);
    finger("pointerdown", 1, 300, 400);
    finger("pointerup", 1, 300, 400);
    await settle(100);
    expect(game.running()).toBe(true);
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
    // The thumb still down as the run ended, lifted after it, does not start the next one.
    finger("pointerup", 2, middle.x + 60, middle.y);
    await settle(100);
    expect(game.running()).toBe(false);
    expect(game.byId("thumb-again")?.hidden).toBe(false);
  }, 40_000);
});
