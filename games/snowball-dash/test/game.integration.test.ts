import { defaultSound } from "@ador/game-sdk/audio/settings";
import { afterEach, describe, expect, it } from "vitest";

import { recordingRuns } from "@ador/test-kit/simulated-game-host";
import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

const byId = (window: { document: Document }, id: string) =>
  window.document.getElementById(id);

describe("Snowball Dash, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(true);
    await settle();
    expect(byId(window, "status")?.textContent).toBe("Connected.");
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(true);
    expect(byId(window, "total")?.textContent).toBe("40");
    expect(byId(window, "count")?.textContent).toBe("0");
  });

  it("starts a run, says how to play and nothing about the platform, and runs until a rock is hit", async () => {
    const recorded = recordingRuns();
    const { stored, window } = await play(
      { best: 0 },
      {},
      { runs: recorded.runs },
    );
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "note")?.textContent).toContain("hop");
    expect(byId(window, "note")?.textContent).not.toMatch(
      /platform|claim|seed/i,
    );
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(false);
    // Left alone the snowball meets the first rock in about three seconds, and the run ends.
    await settle(3_500);
    const start = byId(window, "start");
    expect(start?.textContent).toBe("Roll again");
    expect(start?.hasAttribute("hidden")).toBe(false);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(true);
    expect(byId(window, "note")?.textContent).not.toMatch(
      /platform|claim|seed/i,
    );
    expect(recorded.submitted).toHaveLength(1);
    expect(recorded.submitted[0]?.runId).toBe("run-1");
    expect(recorded.submitted[0]?.record).toMatchObject({ seed: 424_242 });
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
  }, 15_000);

  it("reports a milestone to the platform once a hop has earned it, and lists it once, without rebuilding the list", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    const list = byId(window, "earned");
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    const added: number[] = [];
    const removed: number[] = [];
    new window.MutationObserver((records) => {
      for (const record of records) {
        added.push(record.addedNodes.length);
        removed.push(record.removedNodes.length);
      }
    }).observe(list ?? window.document.body, { childList: true });
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Space" }),
    );
    await settle(600);
    window.dispatchEvent(new window.KeyboardEvent("keyup", { code: "Space" }));
    await settle(400);
    expect(Object.keys(stored.unlocked)).toContain("first-hop");
    const items = [...window.document.querySelectorAll("#earned li")].map(
      (item) => item.textContent,
    );
    expect(items[0]).toBe("first-hop");
    expect(new Set(items).size).toBe(items.length);
    expect(byId(window, "count")?.textContent).toBe(String(items.length));
    // Every change to the list is an item added: the page never tears the list down while a run is played.
    expect(removed.reduce((sum, count) => sum + count, 0)).toBe(0);
    expect(added.reduce((sum, count) => sum + count, 0)).toBe(items.length);
  }, 15_000);

  it("starts the next run with an empty list and a count of nothing", async () => {
    const { window } = await play({ best: 0 });
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Space" }),
    );
    await settle(300);
    window.dispatchEvent(new window.KeyboardEvent("keyup", { code: "Space" }));
    await settle(3_500);
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(false);
    expect(
      window.document.querySelectorAll("#earned li").length,
    ).toBeGreaterThan(0);
    await settle(500);
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(window.document.querySelectorAll("#earned li")).toHaveLength(0);
    expect(byId(window, "count")?.textContent).toBe("0");
  }, 20_000);

  it("says so when the platform does not answer, and can still be played", async () => {
    const { window } = await play(undefined, {
      loadProgress: async () => {
        throw new Error("down");
      },
    });
    await settle();
    expect(byId(window, "status")?.textContent).toBe(
      "The platform said: unavailable",
    );
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
  });
});
