import { installFakeAudio } from "@ador/game-sdk/audio/fake";
import { defaultSound } from "@ador/game-sdk/audio/settings";
import { pauseCopy } from "@ador/game-sdk/pause";
import { afterEach, describe, expect, it } from "vitest";

import { recordingRuns } from "@ador/test-kit/simulated-game-host";
import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// Aurora Pulse's page, bundled and run against a simulated platform: the connection, the start, the lanes, the pause and the end of a run. The
// chart is from a seed of the page's own, and the page runs on the real clock, so these look at what a tap and a pause do, not at a score.
async function opened(
  saved: Parameters<typeof play>[0] = { best: 0 },
  services: Parameters<typeof play>[2] = {},
) {
  const { stored, window } = await play(saved, {}, services);
  const audio = installFakeAudio(window);
  await settle();
  const el = (id: string) => window.document.getElementById(id);
  const press = (code: string) =>
    window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
  const earned = () =>
    [...window.document.querySelectorAll("#earned li")].map(
      (item) => item.textContent,
    );
  return { audio, earned, el, press, stored, window };
}

describe("Aurora Pulse's page", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { el } = await opened();
    expect(el("status")?.textContent).toBe("Connected.");
    expect(el("start")?.hasAttribute("disabled")).toBe(false);
    expect(el("total")?.textContent).toBe("40");
    expect(el("pause")?.hasAttribute("disabled")).toBe(true);
  });

  it("does not start while the platform has not answered", async () => {
    const { window } = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(
      window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(false);
  });

  it("starts on Enter and says how to play, and a lane does not start a run, nor a second Enter throw one away", async () => {
    const { el, press } = await opened();
    press("KeyD");
    await settle(60);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    press("Enter");
    await settle(100);
    expect(el("start")?.hasAttribute("hidden")).toBe(true);
    expect(el("pause")?.hasAttribute("disabled")).toBe(false);
    expect(el("note")?.textContent).toContain("Tap each note");
    expect(el("note")?.textContent).not.toMatch(/platform|claim|seed/i);
    press("Enter");
    await settle(50);
    expect(el("start")?.hasAttribute("hidden")).toBe(true);
  });

  it("makes a sound for a tap in a run, and none before it", async () => {
    const { audio, press } = await opened();
    press("KeyD");
    expect(audio.noises).toHaveLength(0);
    press("Enter");
    await settle(100);
    const started = audio.noises.length;
    // The first notes are a second away, so a tap now is a stray, which has a sound (a burst of noise) of its own.
    press("KeyD");
    press("KeyF");
    expect(audio.noises.length).toBe(started + 2);
  });

  it("pauses on P, on Space and on the button, and goes on after", async () => {
    const { el, press, window } = await opened();
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(el("pause")?.textContent).toBe("Resume");
    expect(el("note")?.textContent).toBe(pauseCopy.paused);
    press("Space");
    expect(el("pause")?.textContent).toBe("Pause");
    el("pause")?.dispatchEvent(new window.MouseEvent("click"));
    expect(el("pause")?.textContent).toBe("Resume");
  });

  it("ends the run when the light goes out (a player who never taps), saves the best, and says nothing about the platform", async () => {
    const recorded = recordingRuns();
    const { el, press, stored } = await opened(undefined, {
      runs: recorded.runs,
    });
    press("Enter");
    await settle(100);
    for (let at = 0; at < 600 && el("start")?.hasAttribute("hidden"); at += 1)
      await settle(100);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    expect(el("start")?.textContent).toBe("Play again");
    expect(el("note")?.textContent).not.toMatch(/platform|claim|seed/i);
    expect(recorded.submitted).toHaveLength(1);
    expect(recorded.submitted[0]?.runId).toBe("run-1");
    expect(recorded.submitted[0]?.record).toMatchObject({ seed: 424_242 });
    expect(stored.progress).toEqual({ best: 0, sound: defaultSound });
    expect(el("pause")?.hasAttribute("disabled")).toBe(true);
  }, 90_000);

  it("offers the sound panel in its place", async () => {
    const { el } = await opened();
    expect(el("sound")?.children.length).toBeGreaterThan(0);
  });
});
