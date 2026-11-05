import { describe, expect, it } from "vitest";

import { bomb, kindSlots, star } from "../src/rules/constants.ts";
import type { Step } from "../src/rules/resolve.ts";
import { startRun } from "../src/rules/state.ts";
import { swapOnce } from "../src/rules/swap.ts";
import { frames, buildTimeline, praiseFor } from "../src/screen/timeline.ts";
import { traceOf } from "../src/screen/trace.ts";
import { legalMoves } from "../src/rules/moves.ts";

const step = (made: readonly (readonly [number, number])[] = []): Step => ({
  after: [],
  before: [],
  clear: [],
  drops: [],
  fired: [],
  made,
});

describe("the words for a play", () => {
  it("grow with the chain, and name what was made when there was no chain", () => {
    expect(
      [1, 2, 3, 4, 5, 9].map((depth) => praiseFor(depth, [step()])),
    ).toEqual([null, "SWEET!", "TASTY!", "DELICIOUS!", "DIVINE!", "DIVINE!"]);
    expect(praiseFor(1, [step([[3, 2 + bomb * kindSlots]])])).toBe("BOMB!");
    expect(praiseFor(1, [step([[3, 2 + star * kindSlots]])])).toBe("STAR!");
    expect(praiseFor(2, [step([[3, 2 + bomb * kindSlots]])])).toBe("BOMB!");
    expect(praiseFor(3, [step([[3, 2 + star * kindSlots]])])).toBe("TASTY!");
  });
});

describe("the playback of a swap", () => {
  const before = startRun(11);
  const [cell, to] = legalMoves(before.board)[0] ?? [0, 1];
  const after = swapOnce(before, cell, to);
  if (typeof after === "string") throw new Error(after);
  const done = traceOf(before, cell, to);
  const timeline = buildTimeline(before, after, cell, to, done);

  it("is the very steps the rules took: they end on the board the swap left", () => {
    expect(done.steps.length).toBeGreaterThanOrEqual(1);
    expect(done.steps.at(-1)?.after).toEqual(after.board);
    expect(done.depth).toBe(after.lastDepth);
    expect(done.points).toBe(after.lastGain);
  });

  it("begins with the swap, then a pop and a fall for each step, in order", () => {
    expect(timeline.swap).toEqual([cell, cell + (to === 1 ? 1 : 8)]);
    expect(timeline.pops).toHaveLength(done.steps.length);
    expect(timeline.pops[0]).toBe(frames.swap);
    timeline.pops.forEach((pop, at) =>
      expect(pop).toBe(frames.swap + at * (frames.pop + frames.fall)),
    );
    expect(timeline.length).toBe(
      frames.swap + done.steps.length * (frames.pop + frames.fall),
    );
    expect(timeline.cues[0]).toEqual({ frame: 0, sound: "swap" });
    expect(
      timeline.cues
        .filter((cue) => cue.sound?.startsWith("match"))
        .map((cue) => cue.frame),
    ).toEqual(timeline.pops);
  });

  it("rings higher for each step of a chain, to the fifth", () => {
    const longer = {
      ...done,
      steps: [
        done.steps[0],
        done.steps[0],
        done.steps[0],
        done.steps[0],
        done.steps[0],
        done.steps[0],
      ].flatMap((s) => (s === undefined ? [] : [s])),
    };
    const sounds = buildTimeline(before, after, cell, to, longer)
      .cues.filter((cue) => cue.sound?.startsWith("match"))
      .map((cue) => cue.sound);
    expect(sounds).toEqual([
      "match0",
      "match1",
      "match2",
      "match3",
      "match4",
      "match4",
    ]);
  });

  it("adds a banner and then the new board when the level was cleared, and the shuffle when the board was shuffled, and the end when the run ended", () => {
    const cleared = buildTimeline(
      before,
      { ...after, levelCleared: true },
      cell,
      to,
      done,
    );
    expect(cleared.bannerAt).toBe(timeline.length);
    expect(cleared.length).toBe(timeline.length + frames.banner + frames.drop);
    expect(cleared.cues.map((cue) => cue.praise)).toContain("LEVEL CLEAR!");
    expect(cleared.shuffleAt).toBe(-1);
    const shuffled = buildTimeline(
      before,
      { ...after, reshuffles: before.reshuffles + 1 },
      cell,
      to,
      done,
    );
    expect(shuffled.shuffleAt).toBe(timeline.length);
    expect(shuffled.length).toBe(timeline.length + frames.shuffle);
    expect(shuffled.bannerAt).toBe(-1);
    const both = buildTimeline(
      before,
      { ...after, levelCleared: true, reshuffles: before.reshuffles + 1 },
      cell,
      to,
      done,
    );
    expect(both.shuffleAt).toBe(-1);
    const ended = buildTimeline(
      before,
      { ...after, ended: true },
      cell,
      to,
      done,
    );
    expect(ended.cues.some((cue) => cue.sound === "lose")).toBe(true);
    expect(timeline.cues.some((cue) => cue.sound === "lose")).toBe(false);
  });

  it("has a sound for a bomb that went off and for a special made", () => {
    const fired = {
      ...done,
      steps: [{ ...step([[1, 2 + bomb * kindSlots]]), fired: [4] }],
    };
    const sounds = buildTimeline(before, after, cell, to, fired).cues.map(
      (cue) => cue.sound,
    );
    expect(sounds).toEqual(expect.arrayContaining(["blast", "special"]));
    expect(timeline.cues.some((cue) => cue.sound === "blast")).toBe(false);
  });
});
