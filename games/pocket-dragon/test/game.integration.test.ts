import { runInNewContext } from "node:vm";
import { join } from "node:path";

import { bundleVerifier } from "@frostbite/game-sdk/build";
import { replayRecord } from "@frostbite/game-sdk/replay";
import type { RunRecord } from "@frostbite/game-sdk/run-record";
import { afterEach, describe, expect, it } from "vitest";

import { instructions } from "../src/guide.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { createQuestSession } from "../src/quest-session.ts";
import { sampleRun } from "../src/sample-run.ts";
import { playCastle } from "./support/castle-bot.ts";
import { closeGame, play, settle, whileRunning } from "./support/page.ts";

afterEach(closeGame);

// A seed on which a dragon that only runs right loses its three hearts in under seven seconds of play, so a run ends quickly.
const quickLoss = 6;

describe("the verifier the game publishes", () => {
  it("is one script with the three levels' rules and the quest's, which replays the sample, a run of the castle and a quest as the source does", async () => {
    const built = await bundleVerifier(join(import.meta.dirname, ".."));
    expect(built).toMatchObject({ id: "pocket-dragon", version: 2 });
    expect(built?.bytes ?? 0).toBeLessThan(200_000);
    const scope: Record<string, unknown> = {};
    runInNewContext(built?.code ?? "", scope);
    const replay = scope.__frostbiteReplay;
    if (typeof replay !== "function") throw new Error("no replay");
    const verdict = (record: RunRecord): unknown =>
      JSON.parse(String(replay(JSON.stringify(record))));
    expect(verdict(sampleRun())).toMatchObject({
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
    const questRun = createQuestSession({ seed: quickLoss });
    questRun.hold("right", true);
    for (let at = 0; at < 2_000 && !questRun.state().ended; at += 1)
      questRun.tick();
    const lost = questRun.record();
    expect(lost.config).toEqual({ cabinet: "quest" });
    expect(verdict(lost)).toEqual(replayRecord(pocketDragonRules, lost));
    expect(verdict(lost)).toMatchObject({ ok: true });
    expect(
      verdict({ ...sampleRun(), config: { cabinet: "woods" } }),
    ).toMatchObject({ ok: false, reason: "illegal-input" });
    expect(verdict({ ...sampleRun(), seed: sampleRun().seed + 1 })).not.toEqual(
      verdict(sampleRun()),
    );
  }, 30_000);
});

describe("Pocket Dragon, bundled and run against a simulated platform", () => {
  it("connects, offers the quest and the first level only, and lets the player start only once it has", async () => {
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
      false,
      true,
      true,
    ]);
    expect(chapters[0]?.getAttribute("data-chapter")).toBe("quest");
    expect(chapters[0]?.getAttribute("aria-pressed")).toBe("true");
    // Between runs the tab offers Levels, not the Bag, and no place has its buttons in the corner.
    expect(game.byId("menu")?.hasAttribute("hidden")).toBe(false);
    expect(game.byId("bag")?.hasAttribute("disabled")).toBe(true);
    expect(game.window.document.querySelector(".touch-buttons")).toBeNull();
    expect(game.text("stat-0-label")).toBe("Time");
  });

  it("starts on the quest, with its best and Hall of Fame, and offers every level reached for practice", async () => {
    const game = await play({
      best: { castle: 4_200, hills: 9, quest: 31_000, woods: 0 },
      fame: [{ eggs: 70, hearts: 2, score: 31_000, secrets: 3, ticks: 40_000 }],
      unlocked: 3,
    });
    await settle();
    const pressed = () =>
      game.window.document
        .querySelector('[aria-pressed="true"]')
        ?.getAttribute("data-chapter");
    expect(pressed()).toBe("quest");
    expect(game.text("best")).toBe("31000");
    expect(game.text("stat-0-label")).toBe("Time");
    expect(game.window.document.querySelectorAll("#fame li")).toHaveLength(1);
    game.press("Digit2");
    expect(pressed()).toBe("castle");
    expect(game.text("stat-0-label")).toBe("Guild");
    expect(game.text("best")).toBe("4200");
    expect(game.text("thumb-act")).toBe("Talk");
    game.press("Digit1");
    expect(game.text("stat-0-label")).toBe("Eggs");
    expect(game.text("best")).toBe("9");
    game.press("Digit0");
    expect(pressed()).toBe("quest");
  });

  it("plays a run on the platform's seed, sends the record once under the platform's run when it ends, and tells how it went", async () => {
    const sent: { record: RunRecord; runId: string }[] = [];
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
        submit: async (runId, record) => {
          sent.push({ record: record as RunRecord, runId });
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
    expect(game.text("note")).toBe(instructions("quest"));
    expect(game.running()).toBe(true);
    game.press("ArrowRight");
    await whileRunning(game, 200);
    expect(game.running()).toBe(false);
    await settle(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.runId).toBe("run-1");
    expect(sent[0]?.record).toMatchObject({
      config: { cabinet: "quest" },
      seed: quickLoss,
    });
    expect(game.text("note")).toContain("The quest ended in Egg Hills.");
    expect(game.text("stat-1")).toBe("0");
    expect(game.byId("start")?.textContent).toBe("Play again");
    expect(game.stored.progress).toMatchObject({ unlocked: 1 });
  }, 40_000);

  it("plays on a seed of its own when the platform offers no runs, with the Bag of the level it is in", async () => {
    const game = await play();
    await settle();
    game.click("start");
    await settle(150);
    expect(game.text("note")).toBe(instructions("quest"));
    expect(game.byId("pause")?.hasAttribute("disabled")).toBe(false);
    const offered = ["menu", "bag"].filter(
      (id) => game.byId(id)?.hasAttribute("hidden") === false,
    );
    expect(offered).toEqual(["bag"]);
    expect(game.byId("bag")?.hasAttribute("disabled")).toBe(false);
    expect(game.window.document.querySelector(".touch-buttons")).toBeNull();
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
