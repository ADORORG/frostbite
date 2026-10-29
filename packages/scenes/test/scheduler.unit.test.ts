import { describe, expect, it, vi } from "vitest";

import {
  chooseRunning,
  createScheduler,
  type Participant,
} from "../src/engine/index.ts";

// A clock and frame loop the test drives by hand.
function manual() {
  let callback: ((milliseconds: number) => void) | null = null;
  let hidden = false;
  let next = 1;
  const cancelled: number[] = [];
  return {
    cancelled,
    environment: {
      cancelFrame: (handle: number) => {
        cancelled.push(handle);
        callback = null;
      },
      hidden: () => hidden,
      requestFrame: (run: (milliseconds: number) => void) => {
        callback = run;
        return next++;
      },
    },
    hide: (value: boolean) => {
      hidden = value;
    },
    pending: () => callback !== null,
    tick: (milliseconds: number) => callback?.(milliseconds),
  };
}

function participant(over: Partial<Participant> & { at?: number } = {}) {
  const frames: number[] = [];
  const stills = vi.fn();
  const value: Participant = {
    distance: () => over.at ?? 0,
    drawFrame: (seconds) => frames.push(seconds),
    drawStill: stills,
    fps: over.fps ?? 30,
    force: over.force ?? false,
  };
  return { frames, stills, value };
}

const options = { cap: 2, rankEveryMs: 400 };
const setUp = () => {
  const clock = manual();
  const scheduler = createScheduler(clock.environment, options);
  scheduler.start();
  scheduler.setPlayback("play");
  return { clock, scheduler };
};

describe("choosing what moves", () => {
  const item = (force: boolean, at: number) => ({ distance: () => at, force });

  it("takes every forced one and the nearest others up to the cap", () => {
    const far = item(false, 900);
    const near = item(false, 10);
    const middle = item(false, 300);
    const forced = item(true, 5000);
    const chosen = chooseRunning([far, near, middle, forced], 2);
    expect(chosen).toEqual([forced, near, middle]);
  });

  it("takes none of the others with a cap of zero, and still the forced", () => {
    const forced = item(true, 1);
    expect(chooseRunning([item(false, 1), forced], 0)).toEqual([forced]);
  });
});

describe("the frame loop", () => {
  it("draws only the scenes that are on screen", () => {
    const { clock, scheduler } = setUp();
    const shown = participant();
    const hiddenOne = participant();
    scheduler.register(shown.value).setVisible(true);
    scheduler.register(hiddenOne.value);
    clock.tick(1000);
    expect(shown.frames).toEqual([1]);
    expect(hiddenOne.frames).toEqual([]);
  });

  it("moves no more than the cap of the unforced ones, the nearest first, and still frames for the rest", () => {
    const { clock, scheduler } = setUp();
    const parts = [900, 10, 300, 50].map((at) => participant({ at }));
    for (const part of parts) scheduler.register(part.value).setVisible(true);
    clock.tick(1000);
    expect(parts.map((part) => part.frames.length)).toEqual([0, 1, 0, 1]);
    expect(parts.map((part) => part.stills.mock.calls.length)).toEqual([
      1, 0, 1, 0,
    ]);
    expect(scheduler.runningCount()).toBe(2);
  });

  it("runs a forced one outside the cap", () => {
    const { clock, scheduler } = setUp();
    const forced = participant({ at: 9999, force: true });
    const others = [1, 2, 3].map((at) => participant({ at }));
    scheduler.register(forced.value).setVisible(true);
    for (const part of others) scheduler.register(part.value).setVisible(true);
    clock.tick(1000);
    expect(forced.frames).toHaveLength(1);
    expect(others.map((part) => part.frames.length)).toEqual([1, 1, 0]);
  });

  it("draws each at its own frame rate", () => {
    const { clock, scheduler } = setUp();
    const quick = participant({ fps: 30 });
    const slow = participant({ fps: 10 });
    scheduler.register(quick.value).setVisible(true);
    scheduler.register(slow.value).setVisible(true);
    for (let at = 1000; at <= 1300; at += 1) clock.tick(at);
    expect(quick.frames.length).toBe(9);
    expect(slow.frames.length).toBe(4);
  });

  it("draws nothing while the tab is hidden, and goes on when it is shown", () => {
    const { clock, scheduler } = setUp();
    const part = participant();
    scheduler.register(part.value).setVisible(true);
    clock.hide(true);
    clock.tick(1000);
    clock.tick(2000);
    expect(part.frames).toEqual([]);
    clock.hide(false);
    clock.tick(3000);
    expect(part.frames).toEqual([3]);
  });

  it("chooses again on an interval, not on every frame", () => {
    const { clock, scheduler } = setUp();
    let at = 0;
    const a = participant();
    const b = participant();
    const nearA = { ...a.value, distance: () => at };
    const nearB = { ...b.value, distance: () => 100 - at };
    const tight = createScheduler(clock.environment, {
      cap: 1,
      rankEveryMs: 400,
    });
    void scheduler;
    tight.start();
    tight.setPlayback("play");
    tight.register(nearA).setVisible(true);
    tight.register(nearB).setVisible(true);
    clock.tick(1000);
    expect(a.frames).toHaveLength(1);
    at = 100;
    clock.tick(1100);
    expect(a.frames).toHaveLength(2);
    expect(b.frames).toHaveLength(0);
    clock.tick(1500);
    expect(b.frames).toHaveLength(1);
  });
});

describe("stills", () => {
  it("shows one still frame for a scene that is on screen while nothing may move, and no more", () => {
    const clock = manual();
    const scheduler = createScheduler(clock.environment, options);
    scheduler.start();
    const part = participant();
    scheduler.register(part.value).setVisible(true);
    expect(part.stills).toHaveBeenCalledTimes(1);
    clock.tick(1000);
    clock.tick(2000);
    clock.tick(3000);
    expect(part.stills).toHaveBeenCalledTimes(1);
    expect(part.frames).toEqual([]);
  });

  it("shows nothing for a scene that is off screen, and a still again when it comes back", () => {
    const clock = manual();
    const scheduler = createScheduler(clock.environment, options);
    scheduler.start();
    const part = participant();
    const registration = scheduler.register(part.value);
    clock.tick(1000);
    expect(part.stills).not.toHaveBeenCalled();
    registration.setVisible(true);
    registration.setVisible(false);
    registration.setVisible(true);
    expect(part.stills).toHaveBeenCalledTimes(2);
  });

  it("stops everything at once when playback is set to still, leaving a still frame, and starts again on play", () => {
    const { clock, scheduler } = setUp();
    const part = participant();
    scheduler.register(part.value).setVisible(true);
    clock.tick(1000);
    expect(part.frames).toHaveLength(1);
    scheduler.setPlayback("still");
    expect(part.stills).toHaveBeenCalledTimes(1);
    expect(scheduler.runningCount()).toBe(0);
    clock.tick(2000);
    expect(part.frames).toHaveLength(1);
    scheduler.setPlayback("play");
    clock.tick(3000);
    expect(part.frames).toHaveLength(2);
  });

  it("gives a scene that loses its place under the cap a still frame", () => {
    const clock = manual();
    const scheduler = createScheduler(clock.environment, {
      cap: 1,
      rankEveryMs: 400,
    });
    scheduler.start();
    scheduler.setPlayback("play");
    let first = 0;
    const a = participant();
    const b = participant();
    scheduler.register({ ...a.value, distance: () => first }).setVisible(true);
    scheduler.register({ ...b.value, distance: () => 50 }).setVisible(true);
    clock.tick(1000);
    expect(b.stills).toHaveBeenCalledTimes(1);
    first = 500;
    clock.tick(2000);
    expect(a.stills).toHaveBeenCalledTimes(1);
    expect(b.frames).toHaveLength(1);
  });
});

describe("starting, stopping and leaving", () => {
  it("asks for one frame loop however often it is started, and cancels it when stopped", () => {
    const clock = manual();
    const scheduler = createScheduler(clock.environment, options);
    scheduler.start();
    scheduler.start();
    expect(clock.pending()).toBe(true);
    scheduler.stop();
    expect(clock.cancelled).toEqual([1]);
    expect(clock.pending()).toBe(false);
    scheduler.stop();
    expect(clock.cancelled).toEqual([1]);
  });

  it("forgets a scene that is disposed of", () => {
    const { clock, scheduler } = setUp();
    const part = participant();
    const registration = scheduler.register(part.value);
    registration.setVisible(true);
    clock.tick(1000);
    registration.dispose();
    clock.tick(2000);
    expect(part.frames).toHaveLength(1);
    expect(scheduler.runningCount()).toBe(0);
  });
});
