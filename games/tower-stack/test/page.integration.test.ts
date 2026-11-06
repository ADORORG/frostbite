import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause and the sound of Tower Stacker's page: the same in every game, and played here through the real page.
describe("Tower Stacker's keys, pause and sound", () => {
  const driver = async (saved?: Parameters<typeof play>[0]) => {
    const { stored, window } = await play(saved ?? { best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const text = (id: string) => byId(window, id)?.textContent;
    const height = () => Number(text("height"));
    return { audio, height, press, stored, text, window };
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
    const { press, window } = await driver();
    press("Enter");
    await settle(100);
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(true);
    expect(byId(window, "drop")?.hasAttribute("disabled")).toBe(false);
  });

  it("starts one run for two quick presses of Enter, and then Enter drops the block", async () => {
    const { audio, height, press } = await driver();
    press("Enter");
    press("Enter");
    await settle(150);
    // The start sound is the one tone of 392 hertz: no music note is that pitch.
    expect(
      audio.oscillators.filter(
        ({ frequency }) => frequency.calls[0]?.[1] === 392,
      ),
    ).toHaveLength(1);
    expect(height()).toBe(0);
    // The first block cannot miss: it is narrower than the sweep is wide, and the tower under it is as wide as the block.
    press("Enter");
    expect(height()).toBe(1);
  });

  it("pauses on P: the page says so, the drop is refused, and play carries on after", async () => {
    const { audio, height, press, text, window } = await driver();
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    press("Space");
    byId(window, "drop")?.dispatchEvent(new window.MouseEvent("click"));
    press("Enter");
    expect(height()).toBe(0);
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    expect(audio.state).toBe("running");
    press("Space");
    expect(height()).toBe(1);
  });

  it("pauses from its button, ignores P when no run is going, and Space drops rather than pauses", async () => {
    const { audio, press, text, window } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    const before = audio.oscillators.length;
    press("Space");
    expect(audio.oscillators.length).toBeGreaterThan(before);
    expect(text("pause")).toBe("Pause");
    byId(window, "pause")?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
  });

  it("plays music while the run goes, a thud or a chime for each drop, a tumble for the miss, and stops the music when the run ends", async () => {
    const { audio, press, window } = await driver();
    press("Enter");
    await settle(100);
    const early = audio.oscillators.length;
    await settle(600);
    expect(audio.oscillators.length).toBeGreaterThan(early);
    // Dropping on whatever tick it lands on, the tower narrows until a drop misses it.
    for (
      let at = 0;
      at < 400 && byId(window, "start")?.hasAttribute("hidden");
      at += 1
    ) {
      press("Space");
      await settle(35);
    }
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(false);
    const glides = (type: string, to: number) =>
      audio.oscillators.filter(
        (voice) =>
          voice.type === type &&
          voice.frequency.calls.some(([, value]) => value === to),
      ).length;
    expect(glides("sawtooth", 70)).toBe(1);
    expect(glides("sine", 70)).toBeGreaterThan(0);
    await settle(100);
    const ended = audio.oscillators.length;
    await settle(500);
    expect(audio.oscillators).toHaveLength(ended);
  }, 40_000);

  it("starts a new run on Enter once a miss has ended the last one, having closed the first once", async () => {
    const { height, press, stored, window } = await driver();
    press("Enter");
    await settle(100);
    for (
      let at = 0;
      at < 400 && byId(window, "start")?.hasAttribute("hidden");
      at += 1
    ) {
      press("Space");
      await settle(35);
    }
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(false);
    await settle(100);
    // The best is saved once, when the run ends.
    expect(stored.saves).toBe(1);
    press("Enter");
    await settle(100);
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(true);
    expect(height()).toBe(0);
  }, 40_000);

  it("pauses when the tab is hidden during a run, and a new run lifts a pause", async () => {
    const { press, text, window } = await driver();
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    Object.defineProperty(window.document, "hidden", {
      configurable: true,
      value: true,
    });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    expect(text("pause")).toBe("Resume");
  });

  it("keeps the sound the player chose, and saves a change with the best", async () => {
    const { stored, text, window } = await driver({
      best: 7,
      sound: { effects: false, music: true, volume: 0.2 },
    });
    const music = window.document.querySelector('[data-sound="music"]');
    expect(music?.textContent).toBe("Music on");
    expect(
      window.document.querySelector('[data-sound="effects"]')?.textContent,
    ).toBe("Effects off");
    expect(text("best")).toBe("7");
    music?.dispatchEvent(new window.MouseEvent("click"));
    await settle();
    expect(stored.progress).toEqual({
      best: 7,
      sound: { effects: false, music: false, volume: 0.2 },
    });
  });
});
