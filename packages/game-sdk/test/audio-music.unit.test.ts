import { describe, expect, it } from "vitest";

import type { Track } from "../src/audio/tracks.ts";
import { defaultSound } from "../src/audio/settings.ts";
import { frequencies, setup, song } from "./support/sound-setup.ts";

describe("music", () => {
  it("is scheduled ahead of the clock, one step after another, at the track's tempo", async () => {
    const { context, sound, timer } = setup();
    await sound.unlock();
    sound.playMusic(song);
    context.currentTime = 1;
    timer.fire();
    const starts = context.oscillators.flatMap(({ starts }) => starts);
    // 0.25 s a step; a rest on the second step.
    expect(starts.length).toBeGreaterThan(0);
    expect(frequencies(context).slice(0, 3)).toEqual([440, 880, 440]);
    const gaps = starts.slice(1).map((at, index) => at - (starts[index] ?? 0));
    expect(gaps[0]).toBeCloseTo(0.5);
    expect(gaps[1]).toBeCloseTo(0.25);
  });

  it("goes on from where it was at the next turn of the timer, not from the start", async () => {
    const { context, sound, timer } = setup();
    await sound.unlock();
    sound.playMusic(song);
    context.currentTime = 1;
    timer.fire();
    const first = context.oscillators.length;
    timer.fire();
    expect(context.oscillators).toHaveLength(first);
    context.currentTime = 2;
    timer.fire();
    expect(context.oscillators.length).toBeGreaterThan(first);
  });

  it("asked for again by the same name, carries on rather than restarting", async () => {
    const { context, sound, timer } = setup();
    await sound.unlock();
    sound.playMusic(song);
    context.currentTime = 1;
    timer.fire();
    const count = context.oscillators.length;
    sound.playMusic(song);
    timer.fire();
    expect(context.oscillators).toHaveLength(count);
  });

  it("runs faster when the game does", async () => {
    const slow = setup();
    const fast = setup();
    for (const { context, sound, timer, scale } of [
      { ...slow, scale: 1 },
      { ...fast, scale: 2 },
    ]) {
      await sound.unlock();
      sound.setTempoScale(scale);
      sound.playMusic(song);
      context.currentTime = 4;
      timer.fire();
    }
    expect(fast.context.oscillators.length).toBeGreaterThan(
      slow.context.oscillators.length,
    );
  });

  it("never runs slower than a quarter of the tempo", async () => {
    const steady: Track = {
      ...song,
      voices: [{ gain: 0.3, hold: 1, notes: [69], wave: "square" }],
    };
    const { context, sound, timer } = setup();
    await sound.unlock();
    sound.setTempoScale(0);
    sound.playMusic(steady);
    context.currentTime = 3;
    timer.fire();
    const starts = context.oscillators.flatMap(({ starts }) => starts);
    expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeCloseTo(1);
  });

  it("is not played while music is off, but keeps time so it comes back in step", async () => {
    const { context, sound, timer } = setup({ ...defaultSound, music: false });
    await sound.unlock();
    sound.playMusic(song);
    context.currentTime = 1;
    timer.fire();
    expect(context.oscillators).toHaveLength(0);
    expect(context.gains[1]?.gain.value).toBe(0);
    sound.configure({ music: true });
    context.currentTime = 2;
    timer.fire();
    expect(context.oscillators.length).toBeGreaterThan(0);
    expect(context.gains[1]?.gain.value).toBeGreaterThan(0);
  });

  it("stops when asked, and can be started again", async () => {
    const { context, sound, timer } = setup();
    await sound.unlock();
    sound.playMusic(song);
    const started = context.oscillators.length;
    sound.stopMusic();
    context.currentTime = 1;
    timer.fire();
    expect(context.oscillators).toHaveLength(started);
    sound.playMusic(song);
    context.currentTime = 2;
    timer.fire();
    expect(context.oscillators.length).toBeGreaterThan(started);
  });

  it("begins when the player unlocks sound after the game asked for it", async () => {
    const { context, sound, timer } = setup();
    sound.playMusic(song);
    await sound.unlock();
    context.currentTime = 1;
    timer.fire();
    expect(context.oscillators.length).toBeGreaterThan(0);
  });

  it("is fed by a timer that closing the sound stops", async () => {
    const { sound, timer } = setup();
    await sound.unlock();
    expect(timer.stopped).toBe(false);
    sound.close();
    sound.close();
    expect(timer.stopped).toBe(true);
  });
});
