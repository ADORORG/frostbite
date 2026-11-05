import { describe, expect, it } from "vitest";

import { createPlayback, frameMs } from "../src/playback.ts";
import { legalMoves } from "../src/rules/moves.ts";
import { startRun } from "../src/rules/state.ts";
import { swapOnce } from "../src/rules/swap.ts";
import { buildTimeline } from "../src/screen/timeline.ts";
import { traceOf } from "../src/screen/trace.ts";

const before = startRun(11);
const [cell, to] = legalMoves(before.board)[0] ?? [0, 1];
const after = swapOnce(before, cell, to);
if (typeof after === "string") throw new Error(after);
const timeline = buildTimeline(
  before,
  after,
  cell,
  to,
  traceOf(before, cell, to),
);

// A playback on a clock the test turns by hand: `advance(ms)` moves the time on and runs what was asked for.
function rig(paused = () => false) {
  let time = 0;
  let waiting: (() => void) | null = null;
  const cues: number[] = [];
  const log = { done: 0, drawn: 0 };
  const playback = createPlayback({
    cue: (cue) => void cues.push(cue.frame),
    done: () => void (log.done += 1),
    draw: () => void (log.drawn += 1),
    now: () => time,
    paused,
    schedule: (callback) => void (waiting = callback),
  });
  const advance = (ms: number) => {
    time += ms;
    const next = waiting;
    waiting = null;
    next?.();
  };
  return { advance, cues, log, playback };
}

describe("a playback", () => {
  it("starts active with the swap's own cue told and the first frame drawn, and has its scene and timeline", () => {
    const { cues, log, playback } = rig();
    expect(playback.active()).toBe(false);
    expect(playback.scene()).toBeNull();
    expect(playback.timeline()).toBeNull();
    playback.start(timeline);
    expect(playback.active()).toBe(true);
    expect(playback.timeline()).toBe(timeline);
    expect(playback.scene()).not.toBeNull();
    expect(cues).toEqual([0]);
    expect(log.drawn).toBe(1);
  });

  it("counts frames by the clock, tells each cue once as its frame comes, and is done after the last frame", () => {
    const { advance, cues, log, playback } = rig();
    playback.start(timeline);
    let guard = 0;
    while (playback.active() && guard < 500) {
      advance(frameMs);
      guard += 1;
    }
    expect(playback.active()).toBe(false);
    expect(log.done).toBe(1);
    expect(cues).toEqual(
      timeline.cues.map((cue) => cue.frame).sort((x, y) => x - y),
    );
    expect(guard).toBeGreaterThanOrEqual(timeline.length - 1);
    expect(guard).toBeLessThanOrEqual(timeline.length + 1);
    expect(playback.scene()).toBeNull();
  });

  it("catches up when a frame comes late (several frames at once, all cues in between told), and does not run on when the clock is still", () => {
    const { advance, cues, log, playback } = rig();
    playback.start(timeline);
    const drawn = log.drawn;
    advance(1);
    expect(log.drawn).toBe(drawn + 1);
    advance(frameMs * 10);
    expect(playback.active()).toBe(true);
    advance(frameMs * (timeline.length + 5));
    expect(playback.active()).toBe(false);
    expect(cues.length).toBe(timeline.cues.length);
  });

  it("stands still while paused, not counting the time paused, and goes on after", () => {
    let paused = false;
    const { advance, log, playback } = rig(() => paused);
    playback.start(timeline);
    advance(frameMs * 3);
    paused = true;
    advance(frameMs * 1_000);
    advance(frameMs * 1_000);
    expect(playback.active()).toBe(true);
    paused = false;
    advance(frameMs * 2);
    expect(playback.active()).toBe(true);
    expect(log.done).toBe(0);
  });

  it("is ended at once by `finish`, which tells the page it is done, and a stale frame does nothing after it", () => {
    const { advance, cues, log, playback } = rig();
    playback.start(timeline);
    playback.finish();
    expect(playback.active()).toBe(false);
    expect(log.done).toBe(1);
    const drawn = log.drawn;
    advance(frameMs * 5);
    expect(log.drawn).toBe(drawn);
    expect(log.done).toBe(1);
    playback.finish();
    expect(log.done).toBe(1);
    expect(cues).toEqual([0]);
  });

  it("starting a new playback ends the old one's frames, and counts from its own start", () => {
    const { advance, log, playback } = rig();
    playback.start(timeline);
    advance(frameMs * 4);
    playback.start(timeline);
    expect(playback.scene()).toEqual(
      expect.objectContaining({ moves: before.moves - 1 }),
    );
    const drawn = log.drawn;
    advance(frameMs);
    expect(log.drawn).toBe(drawn + 1);
    expect(log.done).toBe(0);
  });
});
