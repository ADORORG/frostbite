import { describe, expect, it } from "vitest";

import { createPause } from "../src/pause.ts";
import { createRunLoop } from "../src/run-loop.ts";

// A clock and an animation frame the test turns by hand.
function setup(goOn: (ticks: number) => boolean = () => true) {
  let time = 0;
  const waiting: ((time: number) => void)[] = [];
  const frames: number[] = [];
  const pause = createPause();
  let hidden = false;
  const listeners: (() => void)[] = [];
  const loop = createRunLoop({
    frame: (ticks) => {
      frames.push(ticks);
      return goOn(ticks);
    },
    now: () => time,
    page: {
      addEventListener: (_type, listener) => void listeners.push(listener),
      get hidden() {
        return hidden;
      },
    },
    pause,
    request: (callback) => void waiting.push(callback),
    ticksPerSecond: 60,
  });
  return {
    frames,
    hide(value: boolean) {
      hidden = value;
      for (const listener of listeners) listener();
    },
    loop,
    pause,
    // The next animation frame, `ms` after the last.
    tick(ms: number) {
      time += ms;
      waiting.shift()?.(time);
    },
    waiting,
  };
}

describe("the loop of a real-time game", () => {
  it("is idle until a run is launched, and then runs in whole ticks at the game's rate", async () => {
    const { frames, loop, tick, waiting } = setup();
    expect(loop.running()).toBe(false);
    expect(loop.active()).toBe(false);
    expect(waiting).toHaveLength(0);
    await loop.launch(async () => undefined);
    expect(loop.running()).toBe(true);
    expect(loop.active()).toBe(true);
    tick(50);
    tick(16);
    expect(frames).toEqual([3, 0]);
  });

  it("keeps the part of a tick that was left over, so the game runs at its rate however the frames fall", async () => {
    const { frames, loop, tick } = setup();
    await loop.launch(async () => undefined);
    for (let at = 0; at < 7; at += 1) tick(25);
    // 175 ms is ten and a half ticks at 60 a second: ten are run, and the half is kept.
    expect(frames.reduce((sum, ticks) => sum + ticks, 0)).toBe(10);
  });

  it("starts no second run while one is going or being prepared", async () => {
    const { loop, waiting } = setup();
    let prepared = 0;
    let finish: () => void = () => undefined;
    const first = loop.launch(
      () =>
        new Promise<void>((resolve) => {
          prepared += 1;
          finish = resolve;
        }),
    );
    await loop.launch(async () => void (prepared += 1));
    expect(prepared).toBe(1);
    expect(loop.running()).toBe(false);
    finish();
    await first;
    await loop.launch(async () => void (prepared += 1));
    expect(prepared).toBe(1);
    expect(waiting).toHaveLength(1);
  });

  it("can start again after the game closes a run, and after a failed preparation", async () => {
    const { loop } = setup();
    await expect(
      loop.launch(async () => {
        throw new Error("no run");
      }),
    ).rejects.toThrow("no run");
    expect(loop.running()).toBe(false);
    await loop.launch(async () => undefined);
    loop.stop();
    expect(loop.running()).toBe(false);
    await loop.launch(async () => undefined);
    expect(loop.running()).toBe(true);
  });

  it("stops asking for frames when the game says the run is over", async () => {
    const { loop, tick, waiting } = setup(() => false);
    await loop.launch(async () => undefined);
    tick(20);
    expect(loop.running()).toBe(false);
    expect(waiting).toHaveLength(0);
  });

  it("stands still while paused: no ticks, no frame asked for, and the choices do not count", async () => {
    const { frames, loop, pause, tick, waiting } = setup();
    await loop.launch(async () => undefined);
    pause.set(true);
    expect(loop.active()).toBe(false);
    expect(loop.running()).toBe(true);
    tick(500);
    expect(frames).toEqual([]);
    expect(waiting).toHaveLength(0);
  });

  it("carries on from now when resumed: the time paused is not counted, and only one frame is asked for", async () => {
    const { frames, loop, pause, tick, waiting } = setup();
    await loop.launch(async () => undefined);
    pause.set(true);
    pause.set(false);
    pause.set(true);
    pause.set(false);
    expect(waiting).toHaveLength(1);
    tick(0);
    pause.set(true);
    tick(10_000);
    pause.set(false);
    tick(17);
    expect(frames.at(-1)).toBe(1);
    expect(loop.active()).toBe(true);
  });

  it("does not wake an idle loop when the pause is lifted", () => {
    const { pause, waiting } = setup();
    pause.set(true);
    pause.set(false);
    expect(waiting).toHaveLength(0);
  });

  it("pauses when the tab is hidden during a run, and leaves an idle page alone", async () => {
    const { hide, loop, pause } = setup();
    hide(true);
    expect(pause.paused()).toBe(false);
    hide(false);
    await loop.launch(async () => undefined);
    hide(false);
    expect(pause.paused()).toBe(false);
    hide(true);
    expect(pause.paused()).toBe(true);
  });

  it("lifts a pause left over from the last run when a new one starts", async () => {
    const { loop, pause } = setup();
    await loop.launch(async () => undefined);
    pause.set(true);
    loop.stop();
    await loop.launch(async () => undefined);
    expect(pause.paused()).toBe(false);
    expect(loop.active()).toBe(true);
  });
});
