import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause and the sound of Icicle Drop's page: the same in every game, and played here through the real page.
describe("Icicle Drop's keys, pause and sound", () => {
  const driver = async (saved?: Parameters<typeof play>[0]) => {
    const { stored, window } = await play(saved ?? { best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const text = (id: string) =>
      window.document.getElementById(id)?.textContent;
    const moves = () => Number(text("moves"));
    // Presses each direction until the board changes: the board is random, so one of them may change nothing.
    const slide = () => {
      for (const code of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"]) {
        const before = moves();
        press(code);
        if (moves() > before) return;
      }
    };
    return { audio, moves, press, slide, stored, text, window };
  };

  it("starts a run on Enter once it has connected, and not before the platform has answered", async () => {
    const early = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    early.window.dispatchEvent(
      new early.window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(
      early.window.document
        .querySelector('#pad [data-direction="up"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);
    closeGame();
    const { press, window } = await driver();
    press("Enter");
    await settle(100);
    expect(
      window.document
        .querySelector('#pad [data-direction="up"]')
        ?.hasAttribute("disabled"),
    ).toBe(false);
  });

  it("does not throw away a run that is going when Enter is pressed again", async () => {
    const { moves, press, slide } = await driver();
    press("Enter");
    await settle(100);
    slide();
    const played = moves();
    expect(played).toBeGreaterThan(0);
    press("Enter");
    await settle(100);
    expect(moves()).toBe(played);
  });

  it("pauses on P and on Space: the tiles stay, the page says so, and the moves carry on after", async () => {
    const { moves, press, slide, text } = await driver();
    press("Enter");
    await settle(100);
    for (const code of ["KeyP", "Space"]) {
      const before = moves();
      press(code);
      expect(text("pause")).toBe("Resume");
      expect(text("note")).toContain("Paused");
      slide();
      expect(moves()).toBe(before);
      press(code);
      expect(text("pause")).toBe("Pause");
      expect(text("note")).not.toContain("Paused");
      slide();
      expect(moves()).toBeGreaterThan(before);
    }
  });

  it("pauses from its button, and ignores P when no run is going", async () => {
    const { press, text, window } = await driver();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    press("Enter");
    await settle(100);
    window.document
      .getElementById("pause")
      ?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
  });

  it("plays music and a sound for each move, and a chime that is higher for a join", async () => {
    const { audio, press, slide } = await driver();
    expect(audio.oscillators).toHaveLength(0);
    press("Enter");
    await settle(150);
    const started = audio.oscillators.length;
    expect(started).toBeGreaterThan(0);
    slide();
    expect(audio.oscillators.length).toBeGreaterThan(started);
  });

  it("starts one run for two quick presses of Enter, with one start sound", async () => {
    const { audio, press } = await driver();
    press("Enter");
    press("Enter");
    await settle(150);
    // The start sound is the one tone of 392 hertz: no music note is that pitch.
    const starts = audio.oscillators.filter(
      ({ frequency }) => frequency.calls[0]?.[1] === 392,
    );
    expect(starts).toHaveLength(1);
  });

  it("plays the music for as long as the run lasts, and stops it when the run ends", async () => {
    const { audio, press, text } = await driver();
    press("Enter");
    await settle(100);
    const early = audio.oscillators.length;
    await settle(600);
    expect(audio.oscillators.length).toBeGreaterThan(early);
    // Play to the end: a corner-hugging order gets a run to an end well inside the limit.
    for (let at = 0; at < 3_000; at += 1) {
      press(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"][at % 4] ?? "");
      if (text("note")?.includes("your own claim")) break;
    }
    await settle(100);
    const ended = audio.oscillators.length;
    await settle(500);
    expect(audio.oscillators).toHaveLength(ended);
  }, 20_000);

  it("sounds a join with a chime that glides up by half again, which a plain slide does not", async () => {
    const { audio, press } = await driver();
    press("Enter");
    await settle(100);
    for (let at = 0; at < 200; at += 1)
      press(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"][at % 4] ?? "");
    const chimes = audio.oscillators.filter(({ frequency }) => {
      const from = frequency.calls[0]?.[1] ?? 0;
      const to = frequency.calls[1]?.[1] ?? 0;
      return from > 0 && Math.abs(to / from - 1.5) < 0.001;
    });
    expect(chimes.length).toBeGreaterThan(0);
  });

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

  it("lifts a pause when a new run is started", async () => {
    const { moves, press, slide, text, window } = await driver();
    press("Enter");
    await settle(100);
    press("KeyP");
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(text("pause")).toBe("Pause");
    slide();
    expect(moves()).toBeGreaterThan(0);
  });

  it("goes quiet while paused", async () => {
    const { audio, press } = await driver();
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(audio.state).toBe("suspended");
    press("KeyP");
    expect(audio.state).toBe("running");
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
    expect(music?.textContent).toBe("Music off");
    expect(stored.progress).toEqual({
      best: 7,
      sound: { effects: false, music: false, volume: 0.2 },
    });
  });
});
