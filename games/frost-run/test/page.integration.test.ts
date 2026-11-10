import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { recordingRuns } from "@frostbite/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { heroWords } from "../src/words.ts";
import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause, the sound and the hero select, played through the real page.
describe("the page's keys, pause, sound and hero select", () => {
  const driver = async (saved?: Parameters<typeof play>[0]) => {
    const recorded = recordingRuns();
    let starts = 0;
    const runs = {
      ...recorded.runs,
      start: () => {
        starts += 1;
        return recorded.runs.start();
      },
    };
    const { stored, window } = await play(saved ?? { best: 0 }, {}, { runs });
    const audio = installFakeAudio(window);
    await settle(200);
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const text = (id: string) => byId(window, id)?.textContent;
    const running = () => byId(window, "start")?.hasAttribute("hidden");
    return {
      audio,
      press,
      running,
      starts: () => starts,
      stored,
      text,
      window,
    };
  };

  it("starts on Enter once connected, and not before the platform has answered", async () => {
    const early = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle(200);
    early.window.dispatchEvent(
      new early.window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(byId(early.window, "start")?.hasAttribute("hidden")).toBe(false);
    expect(byId(early.window, "pause")?.hasAttribute("disabled")).toBe(true);
    closeGame();
    const { press, running, window } = await driver();
    press("Enter");
    await settle(150);
    expect(running()).toBe(true);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "main")?.classList.contains("running")).toBe(true);
  });

  it("starts one run for two quick presses of Enter", async () => {
    const { press, starts } = await driver();
    press("Enter");
    press("Enter");
    await settle(200);
    expect(starts()).toBe(1);
  });

  it("turns the hero ring with the arrows and plays as the hero chosen", async () => {
    const { press, text, window } = await driver();
    const name = () =>
      window.document.querySelector('#select [data-part="name"]')?.textContent;
    expect(name()).toBe(heroWords.volt.name);
    press("ArrowRight");
    expect(name()).toBe(heroWords.nib.name);
    press("ArrowLeft");
    press("ArrowLeft");
    expect(name()).toBe(heroWords.pip.name);
    press("Enter");
    await settle(150);
    press("ArrowRight");
    expect(name()).toBe(heroWords.pip.name);
    expect(text("note")).toMatch(/90%/u);
  });

  it("pauses on P and from its button: the page says so, the sound stops, and play carries on after", async () => {
    const { audio, press, text, window } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(150);
    press("KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(audio.state).toBe("running");
    const button = byId(window, "pause");
    button?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
    button?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Pause");
  });

  it("pauses when the tab is hidden during a run", async () => {
    const { press, text, window } = await driver();
    press("Enter");
    await settle(150);
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
