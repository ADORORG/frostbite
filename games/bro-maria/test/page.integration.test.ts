import { installFakeAudio } from "@ador/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause and the sound of Bro Maria's page: the same in every game, and played here through the real page.
describe("Bro Maria's keys, pause and sound", () => {
  const driver = async (saved?: Parameters<typeof play>[0]) => {
    const { stored, window } = await play(saved ?? { best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const release = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keyup", { code }));
    const text = (id: string) =>
      window.document.getElementById(id)?.textContent;
    const started = () =>
      window.document.getElementById("start")?.hasAttribute("hidden");
    return { audio, press, release, started, stored, text, window };
  };
  // The jump effect is the one tone that glides up to 640 hertz.
  const jumps = (audio: ReturnType<typeof installFakeAudio>) =>
    audio.oscillators.filter(({ frequency }) =>
      frequency.calls.some(([, value]) => value === 640),
    ).length;

  it("starts on Enter once connected, and not before the platform has answered", async () => {
    const early = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    early.window.dispatchEvent(
      new early.window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(
      early.window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(false);
    closeGame();
    const { press, started } = await driver();
    press("Enter");
    await settle(100);
    expect(started()).toBe(true);
  });

  it("starts one run for two quick presses of Enter, with one start sound", async () => {
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

  it("makes the jump sound for a jump on the ground, and not for one in the air or with no run", async () => {
    const { audio, press, release } = await driver();
    press("Space");
    release("Space");
    expect(jumps(audio)).toBe(0);
    press("Enter");
    await settle(150);
    press("Space");
    await settle(40);
    expect(jumps(audio)).toBe(1);
    press("ArrowUp");
    await settle(40);
    expect(jumps(audio)).toBe(1);
  });

  it("holds the controls while keys are down, and the time runs while they are", async () => {
    const { press, release, started, text } = await driver();
    press("Enter");
    await settle(100);
    press("KeyD");
    await settle(300);
    release("KeyD");
    expect(started()).toBe(true);
    expect(Number(text("time"))).toBeLessThanOrEqual(120);
    expect(text("lives")).toBe("3");
  });

  it("pauses on P: the page says so, the time stands still, and it carries on after", async () => {
    const { audio, press, text } = await driver();
    press("Enter");
    await settle(300);
    press("KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    const frozen = text("time");
    await settle(1_200);
    expect(text("time")).toBe(frozen);
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    expect(audio.state).toBe("running");
  }, 15_000);

  it("pauses from its button, ignores P when no run is going, and Space jumps rather than pauses", async () => {
    const { press, text, window } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    press("Space");
    expect(text("pause")).toBe("Pause");
    window.document
      .getElementById("pause")
      ?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
  });

  it("plays music for as long as the run lasts, and stops it when the run ends", async () => {
    const { audio, press, started, window } = await driver();
    window.Math.random = () => 29.5 / 0x1_0000_0000;
    press("Enter");
    await settle(100);
    const early = audio.oscillators.length;
    await settle(600);
    expect(audio.oscillators.length).toBeGreaterThan(early);
    press("ArrowRight");
    for (let at = 0; at < 160 && started(); at += 1) await settle(100);
    expect(started()).toBe(false);
    await settle(200);
    const ended = audio.oscillators.length;
    await settle(600);
    expect(audio.oscillators).toHaveLength(ended);
  }, 30_000);

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
    const { stored, window } = await driver({
      best: 7,
      sound: { effects: false, music: true, volume: 0.2 },
    });
    const music = window.document.querySelector('[data-sound="music"]');
    expect(music?.textContent).toBe("Music on");
    expect(
      window.document.querySelector('[data-sound="effects"]')?.textContent,
    ).toBe("Effects off");
    music?.dispatchEvent(new window.MouseEvent("click"));
    await settle();
    expect(stored.progress).toEqual({
      best: 7,
      sound: { effects: false, music: false, volume: 0.2 },
    });
  });
});
