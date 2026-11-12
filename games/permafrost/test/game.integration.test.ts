import { defaultSound } from "@frostbite/game-sdk/audio/settings";
import { recordingRuns } from "@frostbite/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

describe("Permafrost, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(byId(window, "status")?.textContent).toBe("Connected.");
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "catch")?.hasAttribute("disabled")).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 41 });
    await settle();
    expect(byId(window, "best")?.textContent).toBe("41");
  });

  it("starts a run, says how to play and nothing about the platform, and sends the run once it ends", async () => {
    const recorded = recordingRuns();
    const { stored, window } = await play(
      { best: 0 },
      {},
      { runs: recorded.runs },
    );
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "note")?.textContent).toContain("Space catches");
    expect(byId(window, "note")?.textContent).not.toMatch(
      /platform|claim|seed/i,
    );
    expect(byId(window, "catch")?.hasAttribute("disabled")).toBe(false);
    // Catching on whatever tick the click lands on, a tap soon misses and ends the run.
    for (
      let at = 0;
      at < 400 && byId(window, "start")?.hasAttribute("hidden");
      at += 1
    ) {
      byId(window, "catch")?.dispatchEvent(new window.MouseEvent("click"));
      await settle(35);
    }
    const start = byId(window, "start");
    expect(start?.textContent).toBe("Go again");
    expect(start?.hasAttribute("hidden")).toBe(false);
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
  }, 40_000);

  it("sends nothing for a run that was never started", async () => {
    const recorded = recordingRuns();
    const { window } = await play({ best: 0 }, {}, { runs: recorded.runs });
    await settle();
    byId(window, "catch")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(recorded.submitted).toHaveLength(0);
  });

  it("says so when the platform does not answer, and can still be played", async () => {
    const { window } = await play(undefined, {
      loadProgress: async () => {
        throw new Error("down");
      },
    });
    await settle();
    expect(window.document.getElementById("status")?.textContent).toBe(
      "The platform said: unavailable",
    );
    expect(
      window.document.getElementById("start")?.hasAttribute("disabled"),
    ).toBe(false);
  });
});
