import { runInNewContext } from "node:vm";
import { join } from "node:path";

import { bundleVerifier } from "@ador/game-sdk/build";
import { replayRecord } from "@ador/game-sdk/replay";
import type { RunRecord } from "@ador/game-sdk/run-record";
import { afterEach, describe, expect, it } from "vitest";

import { pocketDragonRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";
import { playCastle } from "./support/castle-bot.ts";
import { closeGame, play, settle, whileRunning } from "./support/page.ts";

afterEach(closeGame);

// A seed on which a dragon that only runs right loses its three hearts in under seven seconds of play, so a run ends quickly.
const quickLoss = 6;

describe("the verifier the game publishes", () => {
  it("is one script with the three chapters' rules, which replays the sample and a run of the castle as the source does", async () => {
    const built = await bundleVerifier(join(import.meta.dirname, ".."));
    expect(built).toMatchObject({ id: "pocket-dragon", version: 1 });
    expect(built?.bytes ?? 0).toBeLessThan(200_000);
    const scope: Record<string, unknown> = {};
    runInNewContext(built?.code ?? "", scope);
    const replay = scope.__adorReplay;
    if (typeof replay !== "function") throw new Error("no replay");
    const verdict = (record: RunRecord): unknown =>
      JSON.parse(String(replay(JSON.stringify(record))));
    expect(verdict(sampleRun())).toEqual({
      earned: sampleRun().claims,
      ok: true,
    });
    const quest = playCastle(9);
    const castle: RunRecord = {
      ...sampleRun(),
      claims: [],
      config: { cabinet: "castle" },
      inputs: [...quest.inputs],
      seed: 9,
    };
    expect(verdict(castle)).toEqual(replayRecord(pocketDragonRules, castle));
    expect(
      verdict({ ...sampleRun(), config: { cabinet: "woods" } }),
    ).toMatchObject({ ok: false, reason: "illegal-input" });
    expect(verdict({ ...sampleRun(), seed: sampleRun().seed + 1 })).not.toEqual(
      verdict(sampleRun()),
    );
  }, 30_000);
});

describe("Pocket Dragon, bundled and run against a simulated platform", () => {
  it("connects, opens the first chapter only, and lets the player start only once it has", async () => {
    const game = await play();
    await settle();
    expect(game.text("status")).toBe("Connected.");
    expect(game.byId("start")?.hasAttribute("disabled")).toBe(false);
    expect(game.byId("pause")?.hasAttribute("disabled")).toBe(true);
    const chapters = [
      ...game.window.document.querySelectorAll("[data-chapter]"),
    ];
    expect(chapters.map((button) => button.hasAttribute("disabled"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(chapters[0]?.getAttribute("aria-pressed")).toBe("true");
    for (const button of game.window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(true);
    expect(game.text("stat-0-label")).toBe("Eggs");
  });

  it("goes back to the furthest chapter reached, with that chapter's counts and best", async () => {
    const game = await play({
      best: { castle: 4_200, hills: 9, woods: 0 },
      unlocked: 3,
    });
    await settle();
    const pressed = game.window.document.querySelector('[aria-pressed="true"]');
    expect(pressed?.getAttribute("data-chapter")).toBe("castle");
    expect(game.text("stat-0-label")).toBe("Guild");
    expect(game.text("best")).toBe("4200");
    expect(game.byId("act")?.textContent).toBe("Talk");
    game.press("Digit1");
    expect(game.text("stat-0-label")).toBe("Eggs");
    expect(game.text("best")).toBe("9");
  });

  it("plays a run on the platform's seed, sends the record when it ends, and says what the platform made of it", async () => {
    const sent: unknown[] = [];
    const game = await play(
      null,
      {},
      {
        start: async () => ({
          expiresAt: "2026-10-31T23:00:00.000Z",
          runId: "run-1",
          seed: quickLoss,
          status: "started",
        }),
        submit: async (_runId, record) => {
          sent.push(record);
          const replayed = replayRecord(pocketDragonRules, record as RunRecord);
          return replayed.ok
            ? { earned: [...replayed.earned], status: "verified" }
            : { reason: replayed.reason, status: "rejected" };
        },
      },
    );
    await settle();
    game.click("start");
    await settle(150);
    expect(game.text("note")).toContain("The platform will check this run");
    expect(game.running()).toBe(true);
    game.press("ArrowRight");
    await whileRunning(game, 200);
    expect(game.running()).toBe(false);
    await settle(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      config: { cabinet: "hills" },
      seed: quickLoss,
    });
    expect(game.text("note")).toContain("The platform checked this run.");
    expect(game.text("stat-1")).toBe("0");
    expect(game.byId("start")?.textContent).toBe("Play again");
    expect(game.stored.progress).toMatchObject({ unlocked: 1 });
  }, 40_000);

  it("plays on a seed of its own when the platform offers no runs, and says the milestones are its own report", async () => {
    const game = await play();
    await settle();
    game.click("start");
    await settle(150);
    expect(game.text("note")).toContain("local seed");
    expect(game.byId("pause")?.hasAttribute("disabled")).toBe(false);
    const offered = [
      ...game.window.document.querySelectorAll("#pad button"),
    ].filter((button) => !button.hasAttribute("hidden"));
    expect(offered.map((button) => button.getAttribute("data-hold"))).toEqual([
      "left",
      "right",
      "act",
      "fire",
    ]);
    expect(offered.every((button) => !button.hasAttribute("disabled"))).toBe(
      true,
    );
    expect(
      game.window.document
        .querySelector("[data-chapter]")
        ?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("says so when the platform does not answer, and can still be played", async () => {
    const game = await play(null, {
      loadProgress: async () => {
        throw new Error("down");
      },
    });
    await settle();
    expect(game.text("status")).toBe("The platform said: unavailable");
    expect(game.byId("start")?.hasAttribute("disabled")).toBe(false);
  });
});
