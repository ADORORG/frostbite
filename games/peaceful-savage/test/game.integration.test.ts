import { defaultSound } from "@frostbite/game-sdk/audio/settings";
import { recordingRuns } from "@frostbite/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// jsdom has no WebGL 2, so the page says so and the game is played on the flat map instead.
const flat = "This device has no WebGL 2, so you play on a map.";

describe("Peaceful Savage: Light the Tree, bundled and run against a simulated platform", () => {
  it("connects, says it plays on the map here, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(byId(window, "status")?.textContent).toBe(`Connected. ${flat}`);
    expect(byId(window, "world")?.hasAttribute("hidden")).toBe(true);
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "act")?.hasAttribute("disabled")).toBe(true);
    expect(byId(window, "main")?.dataset.phase).toBe("ready");
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 41 });
    await settle(100);
    expect(byId(window, "best")?.textContent).toBe("41");
  });

  it("starts a run with the one chosen, says how to play and nothing about the platform, and sends the run when it is ended", async () => {
    const recorded = recordingRuns();
    const { stored, window } = await play(
      { best: 0 },
      {},
      { runs: recorded.runs },
    );
    await settle();
    byId(window, "next")?.dispatchEvent(new window.MouseEvent("click"));
    byId(window, "next")?.dispatchEvent(new window.MouseEvent("click"));
    expect(byId(window, "hero-name")?.textContent).toBe("Zora");
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "main")?.dataset.phase).toBe("running");
    expect(byId(window, "note")?.textContent).toContain("Q opens vision");
    expect(byId(window, "note")?.textContent).not.toMatch(
      /platform|claim|seed/i,
    );
    expect(byId(window, "act")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "family")?.textContent).toBe("1 of 4");
    await settle(300);
    byId(window, "end")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    const start = byId(window, "start");
    expect(start?.textContent).toBe("Go again");
    expect(start?.hasAttribute("hidden")).toBe(false);
    expect(byId(window, "main")?.dataset.phase).toBe("over");
    expect(recorded.submitted).toHaveLength(1);
    expect(recorded.submitted[0]?.runId).toBe("run-1");
    expect(recorded.submitted[0]?.record).toMatchObject({ seed: 424_242 });
    // The one chosen leads (Zora is hero 1), and the run ends where it was ended.
    expect(recorded.submitted[0]?.record).toMatchObject({
      inputs: expect.arrayContaining([
        { data: { hero: 1, tick: 0 }, type: "lead" },
        expect.objectContaining({ type: "end" }),
      ]),
    });
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
  });

  it("sends nothing for a run that was never started", async () => {
    const recorded = recordingRuns();
    const { window } = await play({ best: 0 }, {}, { runs: recorded.runs });
    await settle();
    byId(window, "end")?.dispatchEvent(new window.MouseEvent("click"));
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
    expect(byId(window, "status")?.textContent).toBe(
      `The platform said: unavailable ${flat}`,
    );
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
  });
});
