import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the choosing, the pause and the sound of the page, played through the real page.
describe("the page's keys, choosing, pause and sound", () => {
  const driver = async (saved?: Parameters<typeof play>[0]) => {
    const { stored, window } = await play(saved ?? { best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const key = (type: "keydown" | "keyup", code: string) =>
      window.dispatchEvent(new window.KeyboardEvent(type, { code }));
    const press = (code: string) => {
      key("keydown", code);
      key("keyup", code);
    };
    const text = (id: string) => byId(window, id)?.textContent;
    const phase = () => byId(window, "main")?.dataset.phase;
    return { audio, key, phase, press, stored, text, window };
  };

  it("starts on Enter once connected, and not before the platform has answered", async () => {
    const early = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    early.window.dispatchEvent(
      new early.window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(byId(early.window, "start")?.hasAttribute("hidden")).toBe(false);
    closeGame();
    const { phase, press, window } = await driver();
    press("Enter");
    await settle(100);
    expect(phase()).toBe("running");
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(false);
  });

  it("puts the first-screen card away on an arrow to show the family, and turns to the next on each", async () => {
    const { phase, press, text, window } = await driver();
    expect(byId(window, "hero")?.hasAttribute("hidden")).toBe(true);
    press("ArrowRight");
    expect(phase()).toBe("choosing");
    expect(byId(window, "hero")?.hasAttribute("hidden")).toBe(false);
    expect(text("hero-name")).toBe("Kai");
    press("ArrowRight");
    expect(text("hero-name")).toBe("Zora");
    press("ArrowLeft");
    press("ArrowLeft");
    expect(text("hero-name")).toBe("Dr. Ali Savage");
    press("Enter");
    await settle(100);
    expect(phase()).toBe("running");
    expect(byId(window, "hero")?.hasAttribute("hidden")).toBe(true);
  });

  it("starts one run for two quick presses of Enter", async () => {
    const { audio, press } = await driver();
    press("Enter");
    press("Enter");
    await settle(150);
    // The start sound is the one tone of 392 hertz: no note of the music is that pitch.
    expect(
      audio.oscillators.filter(
        ({ frequency }) => frequency.calls[0]?.[1] === 392,
      ),
    ).toHaveLength(1);
  });

  it("pauses on P and from its button, says so, and carries on after", async () => {
    const { audio, press, text, window } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    const button = byId(window, "pause");
    button?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
    button?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Pause");
  });

  it("wakes the tree with a hand on it when Mama leads (she starts beside it), opens vision, and lists what that earns", async () => {
    const { key, press, stored, text, window } = await driver();
    // The first arrow shows the family, with Kai chosen; then round to Daddy, and Mama.
    press("ArrowLeft");
    press("ArrowLeft");
    press("ArrowLeft");
    expect(text("hero-name")).toBe("Mama Heerah");
    press("Enter");
    await settle(150);
    expect(text("prompt")).toBe("E: Touch the ancestor tree");
    key("keydown", "KeyE");
    key("keyup", "KeyE");
    await settle(100);
    expect(text("toast")).toContain("The tree wakes");
    press("KeyQ");
    await settle(150);
    const earned = [
      ...(byId(window, "earned")?.querySelectorAll("li") ?? []),
    ].map((item) => item.dataset.milestone);
    expect(earned).toEqual(["first-touch", "savage-vision"]);
    expect(Object.keys(stored.unlocked).sort()).toEqual([
      "first-touch",
      "savage-vision",
    ]);
    key("keydown", "ArrowUp");
    await settle(200);
    key("keyup", "ArrowUp");
    press("Digit1");
    await settle(100);
    expect(byId(window, "moment")?.hasAttribute("hidden")).toBe(false);
    expect(text("moment-title")).toBe("Practise Cup");
  });

  it("plays music while the run goes, and stops it when the run is ended, having saved the best once", async () => {
    const { audio, phase, press, stored, window } = await driver();
    press("Enter");
    await settle(100);
    const early = audio.oscillators.length;
    // The lullaby is slow: its next notes come within a second and a half.
    await settle(1_500);
    expect(audio.oscillators.length).toBeGreaterThan(early);
    byId(window, "end")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(phase()).toBe("over");
    expect(stored.saves).toBe(1);
    const ended = audio.oscillators.length;
    await settle(500);
    expect(audio.oscillators).toHaveLength(ended);
    press("Enter");
    await settle(100);
    expect(phase()).toBe("running");
  }, 40_000);
});
