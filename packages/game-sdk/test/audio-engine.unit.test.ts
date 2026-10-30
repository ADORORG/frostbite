import { describe, expect, it, vi } from "vitest";

import { tone } from "../src/audio/effects.ts";
import {
  createSound,
  followVisibility,
  intervalTimer,
} from "../src/audio/engine.ts";
import { defaultSound } from "../src/audio/settings.ts";
import { setup, song } from "./support/sound-setup.ts";

describe("sound before the player has acted", () => {
  it("makes nothing and says it is not audible", () => {
    const { context, sound } = setup();
    sound.effect([tone("square", 440, 440, 0.1)]);
    sound.playMusic(song);
    expect(context.oscillators).toHaveLength(0);
    expect(sound.state()).toEqual({
      audible: false,
      available: true,
      settings: defaultSound,
    });
  });

  it("is unavailable, and stays so, where the browser has no audio or refuses it", async () => {
    let tries = 0;
    const sound = createSound({
      context: () => {
        tries += 1;
        throw new Error("no audio");
      },
    });
    await sound.unlock();
    await sound.unlock();
    expect(sound.state()).toMatchObject({ audible: false, available: false });
    expect(tries).toBe(1);
    sound.effect([tone("square", 440, 440, 0.1)]);
  });
});

describe("unlocking", () => {
  it("builds the graph once, sets the levels from the settings and starts the context", async () => {
    const { context, sound } = setup({
      effects: true,
      music: true,
      volume: 0.4,
    });
    await sound.unlock();
    await sound.unlock();
    expect(context.gains).toHaveLength(3);
    const [master, music, effects] = context.gains;
    expect(master?.gain.value).toBeCloseTo(0.4);
    expect(music?.gain.value).toBeGreaterThan(0);
    expect(effects?.gain.value).toBe(1);
    expect(master?.outputs).toEqual([context.destination]);
    expect(music?.outputs).toEqual([master]);
    expect(effects?.outputs).toEqual([master]);
    expect(context.calls).toEqual(["resume"]);
    expect(sound.state().audible).toBe(true);
  });
});

describe("effects", () => {
  it("play each tone from its start, gliding from one pitch to another", async () => {
    const { context, sound } = setup();
    await sound.unlock();
    context.currentTime = 2;
    sound.effect([
      tone("square", 300, 600, 0.2, 0.4),
      tone("triangle", 800, 400, 0.1, 0.3, 0.5),
    ]);
    const [first, second] = context.oscillators;
    expect(first?.type).toBe("square");
    expect(first?.frequency.calls).toEqual([
      ["set", 300, 2],
      ["exp", 600, 2.2],
    ]);
    expect(first?.starts).toEqual([2]);
    expect(second?.starts).toEqual([2.5]);
    expect(second?.frequency.calls[1]).toEqual(["exp", 400, 2.6]);
  });

  it("make noise from one shared buffer", async () => {
    const { context, sound } = setup();
    await sound.unlock();
    sound.effect([tone("noise", 0, 0, 0.1)]);
    sound.effect([tone("noise", 0, 0, 0.1)]);
    expect(context.noises).toHaveLength(2);
    expect(context.noises[0]?.loop).toBe(true);
    expect(context.noises[0]?.buffer).not.toBeNull();
    expect(context.noises[0]?.buffer).toBe(context.noises[1]?.buffer);
    expect(
      context.noises[0]?.buffer?.getChannelData(0).some((value) => value !== 0),
    ).toBe(true);
  });

  it("are silent when the player turns effects off, and speak again when they turn them on", async () => {
    const { changes, context, sound } = setup();
    await sound.unlock();
    sound.configure({ effects: false });
    sound.effect([tone("square", 440, 440, 0.1)]);
    expect(context.oscillators).toHaveLength(0);
    expect(context.gains[2]?.gain.value).toBe(0);
    sound.configure({ effects: true });
    sound.effect([tone("square", 440, 440, 0.1)]);
    expect(context.oscillators).toHaveLength(1);
    expect(changes).toHaveLength(2);
    expect(sound.state().settings.effects).toBe(true);
  });

  it("change the volume with the player's choice", async () => {
    const { context, sound } = setup();
    await sound.unlock();
    sound.configure({ volume: 0.9 });
    expect(context.gains[0]?.gain.value).toBeCloseTo(0.9);
  });
});

describe("pausing", () => {
  it("suspends everything, makes no new effects, and resumes where it left off", async () => {
    const { context, sound } = setup();
    await sound.unlock();
    sound.pause();
    expect(context.state).toBe("suspended");
    expect(sound.state().audible).toBe(false);
    sound.effect([tone("square", 440, 440, 0.1)]);
    expect(context.oscillators).toHaveLength(0);
    sound.resume();
    expect(context.state).toBe("running");
    sound.effect([tone("square", 440, 440, 0.1)]);
    expect(context.oscillators).toHaveLength(1);
  });

  it("does not wake the context on an unlock while the game is paused", async () => {
    const { context, sound } = setup();
    sound.pause();
    await sound.unlock();
    expect(context.state).toBe("suspended");
    sound.resume();
    expect(context.state).toBe("running");
  });

  it("stays quiet while the tab is hidden, even if the game resumes", async () => {
    const { context, sound } = setup();
    await sound.unlock();
    sound.setHidden(true);
    sound.pause();
    sound.resume();
    expect(context.state).toBe("suspended");
    sound.effect([tone("square", 440, 440, 0.1)]);
    expect(context.oscillators).toHaveLength(0);
    sound.setHidden(false);
    expect(context.state).toBe("running");
  });

  it("does nothing to a context that was never made", () => {
    const { sound } = setup();
    sound.pause();
    sound.resume();
    sound.setHidden(true);
    expect(sound.state().audible).toBe(false);
  });
});

describe("following the page's visibility", () => {
  it("hides the sound when the tab is hidden and shows it when it returns", async () => {
    const { context, sound } = setup();
    await sound.unlock();
    const listeners: (() => void)[] = [];
    const page = {
      addEventListener: (_type: string, listener: () => void) =>
        void listeners.push(listener),
      hidden: false,
    };
    followVisibility(sound, page);
    page.hidden = true;
    listeners[0]?.();
    expect(context.state).toBe("suspended");
    page.hidden = false;
    listeners[0]?.();
    expect(context.state).toBe("running");
  });
});

describe("the real timer", () => {
  it("runs on an interval until it is stopped", () => {
    vi.useFakeTimers();
    try {
      let runs = 0;
      const stop = intervalTimer.every(() => (runs += 1), 40);
      vi.advanceTimersByTime(130);
      expect(runs).toBe(3);
      stop();
      vi.advanceTimersByTime(130);
      expect(runs).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
