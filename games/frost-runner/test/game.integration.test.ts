import { defaultSound } from "@ador/game-sdk/audio/settings";
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";

import { recordingRuns } from "@ador/test-kit/simulated-game-host";
import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

describe("Frost Runner, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(window.document.getElementById("status")?.textContent).toBe(
      "Connected.",
    );
    expect(
      window.document.getElementById("start")?.hasAttribute("disabled"),
    ).toBe(false);
    expect(
      window.document.getElementById("jump")?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 321 });
    await settle();
    expect(window.document.getElementById("best")?.textContent).toBe("321");
  });

  it("starts a run, says how to play and nothing about the platform, and runs until the runner is stopped", async () => {
    const recorded = recordingRuns();
    const { stored, window } = await play(
      { best: 0 },
      {},
      { runs: recorded.runs },
    );
    await settle();
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    const note = window.document.getElementById("note")?.textContent ?? "";
    expect(note).toContain("Space jumps");
    expect(note).not.toMatch(/platform|claim|seed/i);
    expect(
      window.document.getElementById("jump")?.hasAttribute("disabled"),
    ).toBe(false);
    // Left alone the runner meets the first obstacle in a couple of seconds, and the run ends.
    await settle(3_500);
    const start = window.document.getElementById("start");
    expect(start?.textContent).toBe("Run again");
    expect(start?.hasAttribute("hidden")).toBe(false);
    expect(window.document.getElementById("note")?.textContent).not.toMatch(
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
