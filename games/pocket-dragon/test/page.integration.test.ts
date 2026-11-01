import { installFakeAudio } from "@ador/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle, whileRunning } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause, the chapters and the sound of the page: the same in every game where the SDK decides them, and played here
// through the real page.
describe("Pocket Dragon's keys, pause, chapters and sound", () => {
  const driver = async (saved: Parameters<typeof play>[0] = null) => {
    const game = await play(saved);
    const audio = installFakeAudio(game.window);
    await settle();
    return { ...game, audio };
  };
  // The start sound is the one tone of 392 hertz: no music note or other effect is that pitch.
  const starts = (audio: ReturnType<typeof installFakeAudio>) =>
    audio.oscillators.filter(({ frequency }) => frequency.calls[0]?.[1] === 392)
      .length;

  it("starts on Enter once connected, and not before the platform has answered", async () => {
    const early = await play(null, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    early.press("Enter");
    await settle(100);
    expect(early.running()).toBe(false);
    closeGame();
    const game = await driver();
    game.press("Enter");
    await settle(100);
    expect(game.running()).toBe(true);
  });

  it("starts one run for two quick presses of Enter, with one start sound", async () => {
    const { audio, press } = await driver();
    press("Enter");
    press("Enter");
    await settle(150);
    expect(starts(audio)).toBe(1);
  });

  it("chooses an open chapter with its number key or its button, and none during a run", async () => {
    const game = await driver({ best: {}, unlocked: 2 });
    const chosen = () =>
      game.window.document
        .querySelector('[aria-pressed="true"]')
        ?.getAttribute("data-chapter");
    expect(chosen()).toBe("woods");
    game.press("Digit1");
    expect(chosen()).toBe("hills");
    game.press("Digit3");
    expect(chosen()).toBe("hills");
    game.window.document
      .querySelector('[data-chapter="woods"]')
      ?.dispatchEvent(new game.window.MouseEvent("click", { bubbles: true }));
    expect(chosen()).toBe("woods");
    expect(game.text("stat-0-label")).toBe("Clues");
    game.press("Enter");
    await settle(100);
    game.press("Digit1");
    expect(chosen()).toBe("woods");
    expect(game.text("note")).toContain("clue stones");
  });

  it("pauses on P: the page says so, the sound stops, and it carries on after", async () => {
    const { audio, press, text } = await driver();
    press("Enter");
    await settle(300);
    press("KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    await settle(300);
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    expect(audio.state).toBe("running");
  }, 15_000);

  it("pauses from its button, ignores P when no run is going, and Space jumps rather than pauses", async () => {
    const { click, press, text } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    press("Space");
    expect(text("pause")).toBe("Pause");
    click("pause");
    expect(text("pause")).toBe("Resume");
  });

  it("pauses when the tab is hidden during a run", async () => {
    const { press, text, window } = await driver();
    press("Enter");
    await settle(100);
    Object.defineProperty(window.document, "hidden", {
      configurable: true,
      value: true,
    });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    expect(text("pause")).toBe("Resume");
  });

  it("plays the chapter's music for as long as the run lasts, and stops it when the run ends", async () => {
    const game = await driver();
    game.window.Math.random = () => 6.5 / 0x1_0000_0000;
    game.press("Enter");
    await settle(100);
    const early = game.audio.oscillators.length;
    await settle(600);
    expect(game.audio.oscillators.length).toBeGreaterThan(early);
    game.press("ArrowRight");
    await whileRunning(game, 200);
    expect(game.running()).toBe(false);
    await settle(200);
    const ended = game.audio.oscillators.length;
    await settle(600);
    expect(game.audio.oscillators).toHaveLength(ended);
    expect(game.text("note")).toContain("your own claim");
  }, 40_000);

  it("keeps the sound the player chose, and saves a change with the chapters reached, the bests and the metaplasma banked", async () => {
    const { stored, window } = await driver({
      best: { castle: 0, hills: 7, woods: 0 },
      plasma: 1234,
      sound: { effects: false, music: true, volume: 0.2 },
      unlocked: 2,
    });
    expect(window.document.querySelector("#banked")?.textContent).toBe("1,234");
    const music = window.document.querySelector('[data-sound="music"]');
    expect(music?.textContent).toBe("Music on");
    expect(
      window.document.querySelector('[data-sound="effects"]')?.textContent,
    ).toBe("Effects off");
    music?.dispatchEvent(new window.MouseEvent("click"));
    await settle();
    expect(stored.progress).toEqual({
      best: { castle: 0, hills: 7, woods: 0 },
      plasma: 1234,
      sound: { effects: false, music: false, volume: 0.2 },
      unlocked: 2,
    });
  });
});
