import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { instructions } from "../src/guide.ts";
import { closeGame, play, settle, whileRunning } from "./support/page.ts";

afterEach(closeGame);

const refused = "That key does not unlock test mode.";

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

  it("chooses the quest or an open level with its number key or its button, and none during a run", async () => {
    const game = await driver({ best: {}, unlocked: 2 });
    const chosen = () =>
      game.window.document
        .querySelector('[aria-pressed="true"]')
        ?.getAttribute("data-chapter");
    expect(chosen()).toBe("quest");
    game.press("Digit1");
    expect(chosen()).toBe("hills");
    game.press("Digit3");
    expect(chosen()).toBe("hills");
    game.window.document
      .querySelector('[data-chapter="castle"]')
      ?.dispatchEvent(new game.window.MouseEvent("click", { bubbles: true }));
    expect(chosen()).toBe("castle");
    expect(game.text("stat-0-label")).toBe("Guild");
    game.press("Enter");
    await settle(100);
    game.press("Digit1");
    expect(chosen()).toBe("castle");
    expect(game.text("note")).toBe(instructions("castle"));
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
    expect(game.byId("share")?.hasAttribute("disabled")).toBe(true);
    game.press("ArrowRight");
    await whileRunning(game, 200);
    expect(game.running()).toBe(false);
    await settle(200);
    // A new card is ready: the share button says so until it is opened.
    expect(game.byId("share")?.classList.contains("fresh")).toBe(true);
    game.click("share");
    expect(game.byId("share")?.classList.contains("fresh")).toBe(false);
    expect(game.byId("card-panel")?.hasAttribute("hidden")).toBe(false);
    game.click("card-close");
    const ended = game.audio.oscillators.length;
    await settle(600);
    expect(game.audio.oscillators).toHaveLength(ended);
    expect(game.text("note")).toBe("The quest ended in Egg Hills.");
  }, 40_000);

  it("opens the player's card between runs, keeps Enter and the chapter keys from the game while it is open, and closes on Escape", async () => {
    const game = await driver({ best: {}, unlocked: 2 });
    const panel = () => game.byId("card-panel");
    const chosen = () =>
      game.window.document
        .querySelector('[data-chapter][aria-pressed="true"]')
        ?.getAttribute("data-chapter");
    expect(game.byId("share")?.hasAttribute("disabled")).toBe(false);
    game.click("share");
    await settle();
    expect(panel()?.hasAttribute("hidden")).toBe(false);
    expect(
      game.window.document.querySelector("main")?.hasAttribute("inert"),
    ).toBe(true);
    // The test's browser cannot draw, so the panel says so rather than offering an empty picture.
    expect(game.text("card-hint")).toBe(
      "This browser could not draw the card.",
    );
    game.press("Enter");
    game.press("Digit1");
    await settle(100);
    expect(game.running()).toBe(false);
    expect(chosen()).toBe("quest");
    game.byId("card-close")?.dispatchEvent(
      new game.window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "Escape",
      }),
    );
    expect(panel()?.hasAttribute("hidden")).toBe(true);
    expect(game.window.document.activeElement?.id).toBe("share");
    game.press("Enter");
    await settle(100);
    expect(game.running()).toBe(true);
  });

  it("keeps test mode locked without the admin's key: holding the title asks for it, a wrong one changes nothing, and runs still count", async () => {
    const game = await driver({ best: {}, unlocked: 1 });
    const hidden = (id: string) => game.byId(id)?.hasAttribute("hidden");
    game
      .byId("title")
      ?.dispatchEvent(
        new game.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    await settle(2_100);
    expect(hidden("test-panel")).toBe(false);
    const input = game.window.document.querySelector("#test-key");
    if (!(input instanceof game.window.HTMLInputElement))
      throw new Error("no key field");
    input.value = "NOT-THE-KEY";
    game.click("test-unlock");
    for (
      let wait = 0;
      wait < 30 && game.text("test-message") !== refused;
      wait += 1
    )
      await settle(100);
    expect(game.text("test-message")).toBe(refused);
    game.click("test-cancel");
    expect(hidden("test-panel")).toBe(true);
    expect(hidden("test-badge")).toBe(true);
    expect(game.text("start")).toBe("Start run");
    game.press("Digit3");
    expect(
      game.window.document
        .querySelector('[data-chapter][aria-pressed="true"]')
        ?.getAttribute("data-chapter"),
    ).toBe("quest");
    game.press("Enter");
    await settle(100);
    expect(game.running()).toBe(true);
    expect(game.text("note")).not.toContain("Test mode");
  }, 20_000);

  it("keeps the sound the player chose, and saves a change with the levels reached, the bests and the metaplasma banked", async () => {
    const { stored, window } = await driver({
      best: { castle: 0, hills: 7, quest: 0, woods: 0 },
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
      best: { castle: 0, hills: 7, quest: 0, woods: 0 },
      fame: [],
      plasma: 1234,
      sound: { effects: false, music: false, volume: 0.2 },
      unlocked: 2,
      won: false,
    });
  });
});
