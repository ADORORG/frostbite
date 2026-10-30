// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tone } from "../src/audio/effects.ts";
import { setUpSound } from "../src/audio/setup.ts";
import { defaultSound } from "../src/audio/settings.ts";
import type { Track } from "../src/audio/tracks.ts";
import { createPause } from "../src/pause.ts";
import { FakeContext, installFakeAudio } from "../src/audio/fake.ts";

const track: Track = {
  name: "t",
  tempo: 120,
  voices: [{ gain: 0.3, hold: 1, notes: [69], wave: "square" }],
};
const effects = { jump: [tone("square", 300, 600, 0.1)] } as const;
let context: FakeContext;

beforeEach(() => {
  context = new FakeContext();
  vi.stubGlobal("AudioContext", function () {
    return context;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function setup() {
  const container = document.createElement("div");
  document.body.append(container);
  const saved: unknown[] = [];
  const pause = createPause();
  const game = setUpSound({
    container,
    effects,
    pause,
    save: (settings) => saved.push(settings),
    track,
  });
  return { container, game, pause, saved };
}

describe("a game's sound, set up in one call", () => {
  it("puts the panel in the container and starts from the defaults", () => {
    const { container, game } = setup();
    expect(container.querySelector(".sound-panel")).not.toBeNull();
    expect(game.sound.state().settings).toEqual(defaultSound);
  });

  it("takes the settings the game read back, shows them, and does not ask the game to save them again", () => {
    const { container, game, saved } = setup();
    game.apply({ effects: true, music: false, volume: 0.3 });
    expect(game.sound.state().settings.music).toBe(false);
    expect(container.querySelector('[data-sound="music"]')?.textContent).toBe(
      "Music off",
    );
    expect(saved).toEqual([]);
    game.apply("nonsense");
    expect(game.sound.state().settings).toEqual(defaultSound);
  });

  it("asks the game to save what the player changes", () => {
    const { container, saved } = setup();
    container
      .querySelector<HTMLButtonElement>('[data-sound="effects"]')
      ?.click();
    expect(saved).toEqual([{ ...defaultSound, effects: false }]);
  });

  it("plays an effect by the game's name for it, once sound is unlocked", async () => {
    const { game } = setup();
    game.sfx("jump");
    expect(context.oscillators).toHaveLength(0);
    await game.sound.unlock();
    game.sfx("jump");
    expect(context.oscillators).toHaveLength(1);
  });

  it("plays an effect made on the spot", async () => {
    const { game } = setup();
    await game.sound.unlock();
    game.play([tone("sine", 500, 900, 0.1)]);
    expect(context.oscillators[0]?.frequency.calls[0]).toEqual(["set", 500, 0]);
  });

  it("starts and stops the music", async () => {
    const { game } = setup();
    await game.sound.unlock();
    game.music(true);
    const started = context.oscillators.length;
    expect(started).toBeGreaterThan(0);
    game.music(false);
    context.currentTime = 5;
    game.sound.close();
    expect(context.oscillators).toHaveLength(started);
  });

  it("speeds the music with the game", async () => {
    vi.useFakeTimers();
    try {
      const { game } = setup();
      await game.sound.unlock();
      game.tempo(2);
      game.music(true);
      context.currentTime = 1;
      vi.advanceTimersByTime(50);
      const starts = context.oscillators.flatMap(({ starts }) => starts);
      // One step is 0.25 s at 120 beats a minute, so 0.125 s at twice the tempo.
      expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeCloseTo(0.125);
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes quiet while the game is paused and comes back when it resumes", async () => {
    const { game, pause } = setup();
    await game.sound.unlock();
    pause.set(true);
    expect(context.state).toBe("suspended");
    pause.set(false);
    expect(context.state).toBe("running");
  });

  it("takes the panel away and stops everything when it is closed", async () => {
    const { container, game } = setup();
    await game.sound.unlock();
    game.music(true);
    const count = context.oscillators.length;
    game.close();
    expect(container.querySelector(".sound-panel")).toBeNull();
    context.currentTime = 5;
    expect(context.oscillators).toHaveLength(count);
  });

  it("goes quiet while the tab is hidden", async () => {
    const { game } = setup();
    await game.sound.unlock();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(context.state).toBe("suspended");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(context.state).toBe("running");
  });
});

describe("the fake audio a game's test installs", () => {
  it("is what a page gets for its AudioContext, with a clock that moves", async () => {
    const target = {};
    const installed = installFakeAudio(target);
    expect(Reflect.get(target, "AudioContext")).toBeTypeOf("function");
    const first = installed.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(installed.currentTime).toBeGreaterThan(first);
  });
});
