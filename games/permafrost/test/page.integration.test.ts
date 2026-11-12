import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause and the sound of the page: the same in every game, and played here through the real page.
describe("the page's keys, pause and sound", () => {
  const driver = async (saved?: Parameters<typeof play>[0]) => {
    const { stored, window } = await play(saved ?? { best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const text = (id: string) => byId(window, id)?.textContent;
    const running = () => byId(window, "start")?.hasAttribute("hidden");
    // Drops pieces where they are born until the stack reaches the top.
    const playOut = async () => {
      for (let at = 0; at < 400 && running(); at += 1) {
        press("Space");
        await settle(35);
      }
    };
    return { audio, playOut, press, running, stored, text, window };
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
    const { press, running, window } = await driver();
    press("Enter");
    await settle(100);
    expect(running()).toBe(true);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(false);
  });

  it("starts one run for two quick presses of Enter", async () => {
    const { audio, press } = await driver();
    press("Enter");
    press("Enter");
    await settle(150);
    // The start sound is the one tone of 392 hertz: no music note is that pitch.
    expect(
      audio.oscillators.filter(
        ({ frequency }) => frequency.calls[0]?.[1] === 392,
      ),
    ).toHaveLength(1);
  });

  it("pauses on P: the page says so, a drop is refused, and play carries on after", async () => {
    const { audio, press, text } = await driver();
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    const before = audio.oscillators.length;
    press("Space");
    expect(audio.oscillators.length).toBe(before);
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    expect(audio.state).toBe("running");
    press("Space");
    expect(audio.oscillators.length).toBeGreaterThan(before);
  });

  it("pauses from its button, ignores P when no run is going, and Space drops rather than pauses", async () => {
    const { audio, press, text, window } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    const button = byId(window, "pause");
    button?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
    button?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Pause");
    const before = audio.oscillators.length;
    press("Space");
    expect(audio.oscillators.length).toBeGreaterThan(before);
    expect(text("pause")).not.toBe("Resume");
  });

  it("plays music while the run goes, and stops it when the run ends", async () => {
    const { audio, playOut, press, running } = await driver();
    press("Enter");
    await settle(100);
    const early = audio.oscillators.length;
    await settle(600);
    expect(audio.oscillators.length).toBeGreaterThan(early);
    await playOut();
    expect(running()).toBe(false);
    await settle(100);
    const ended = audio.oscillators.length;
    await settle(500);
    expect(audio.oscillators).toHaveLength(ended);
  }, 40_000);

  it("starts a new run on Enter once the last has ended, having saved the best once", async () => {
    const { playOut, press, running, stored, text } = await driver();
    press("Enter");
    await settle(100);
    await playOut();
    expect(running()).toBe(false);
    await settle(100);
    expect(stored.saves).toBe(1);
    press("Enter");
    await settle(100);
    expect(running()).toBe(true);
    expect(text("score")).toBe("0");
  }, 40_000);

  it("does not start the next run on Space, so a player still dropping pieces as the run ends keeps the card that says how they did", async () => {
    const { playOut, press, running, text } = await driver();
    press("Enter");
    await settle(100);
    await playOut();
    expect(running()).toBe(false);
    await settle(100);
    const score = text("score");
    for (let at = 0; at < 5; at += 1) {
      press("Space");
      await settle(40);
    }
    expect(running()).toBe(false);
    expect(text("score")).toBe(score);
    press("Enter");
    await settle(100);
    expect(running()).toBe(true);
  }, 40_000);

  it("has the touch buttons in the page in their place always, and in sight only while a run goes, so showing them moves nothing and they never cover the cards", async () => {
    const { playOut, press, running, window } = await driver();
    const cluster = () =>
      window.document.querySelector<HTMLElement>(".touch-buttons");
    const labels = () =>
      [...window.document.querySelectorAll(".touch-buttons button")].map(
        (found) => found.textContent,
      );
    expect(labels()).toEqual(["Drop", "Soft", "Hold", "Turn"]);
    expect(cluster()?.style.visibility).toBe("hidden");
    press("Enter");
    await settle(100);
    expect(labels()).toEqual(["Drop", "Soft", "Hold", "Turn"]);
    expect(cluster()?.style.visibility).toBe("visible");
    await playOut();
    expect(running()).toBe(false);
    await settle(100);
    expect(cluster()?.style.visibility).toBe("hidden");
    press("Enter");
    await settle(100);
    expect(cluster()?.style.visibility).toBe("visible");
  }, 40_000);

  it("pauses when the tab is hidden during a run", async () => {
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
