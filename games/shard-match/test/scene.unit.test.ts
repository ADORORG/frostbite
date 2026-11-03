import { describe, expect, it } from "vitest";

import { legalMoves } from "../src/rules/moves.ts";
import { startRun } from "../src/rules/state.ts";
import { swapOnce } from "../src/rules/swap.ts";
import { cell, cellX, cellY } from "../src/screen/layout.ts";
import { praiseFrames, sceneAt } from "../src/screen/scene.ts";
import {
  buildTimeline,
  frames,
  type Timeline,
} from "../src/screen/timeline.ts";
import { traceOf } from "../src/screen/trace.ts";

// A timeline of the first swap of a run, with the frost, the level clear and the shuffle added when a test asks.
function timelineOf(
  seed: number,
  over: Partial<ReturnType<typeof startRun>> = {},
  extra: Partial<Timeline> = {},
): Timeline {
  const before = { ...startRun(seed), ...over };
  const [cell0, to] = legalMoves(before.board)[0] ?? [0, 1];
  const after = swapOnce(before, cell0, to);
  if (typeof after === "string") throw new Error(after);
  return {
    ...buildTimeline(before, after, cell0, to, traceOf(before, cell0, to)),
    ...extra,
  };
}
const at = (timeline: Timeline, frame: number) => {
  const scene = sceneAt(timeline, frame);
  if (scene === null) throw new Error("no scene");
  return scene;
};

describe("a scene", () => {
  const timeline = timelineOf(11);
  const [a, b] = timeline.swap;

  it("is none before the start and from the end, and one for every frame between", () => {
    expect(sceneAt(timeline, -1)).toBeNull();
    expect(sceneAt(timeline, timeline.length)).toBeNull();
    for (let frame = 0; frame < timeline.length; frame += 1)
      expect(sceneAt(timeline, frame)).not.toBeNull();
  });

  it("slides the two swapped shards past each other, and puts everything else where it lies", () => {
    const start = at(timeline, 0);
    expect(start.pieces[a]?.x).toBe(cellX(a));
    const mid = at(timeline, frames.swap - 1);
    const moved = mid.pieces[a];
    expect(
      Math.hypot((moved?.x ?? 0) - cellX(a), (moved?.y ?? 0) - cellY(a)),
    ).toBeGreaterThan(cell / 2);
    expect(mid.pieces[a]?.value).toBe(timeline.before.board[a]);
    expect(mid.pieces[b]?.value).toBe(timeline.before.board[b]);
    const other =
      [...Array(64).keys()].find((index) => index !== a && index !== b) ?? 0;
    expect(mid.pieces[other]).toMatchObject({
      x: cellX(other),
      y: cellY(other),
    });
  });

  it("flashes the cells of a step as they pop, in turns, and has confetti rising from them", () => {
    const pop = timeline.pops[0] ?? 0;
    const step = timeline.steps[0];
    const flashing = [0, 2].map(
      (offset) =>
        at(timeline, pop + offset).pieces.filter((piece) => piece.flash).length,
    );
    expect(flashing).toContain(step?.clear.length);
    expect(flashing).toContain(0);
    const scene = at(timeline, pop + 3);
    expect(scene.sparks.length).toBeGreaterThanOrEqual(
      (step?.clear.length ?? 0) * 6,
    );
    expect(at(timeline, 0).sparks).toHaveLength(0);
  });

  it("drops what is left into place after the pop: higher up by how far it fell at first, and at rest by the end", () => {
    const step = timeline.steps[0];
    const fall = (timeline.pops[0] ?? 0) + frames.pop;
    const falling = at(timeline, fall);
    const moved =
      [...Array(64).keys()].find((index) => (step?.drops[index] ?? 0) > 0) ?? 0;
    expect(falling.pieces[moved]?.y).toBeLessThan(cellY(moved));
    expect(falling.pieces[moved]?.y).toBeCloseTo(
      cellY(moved) - (step?.drops[moved] ?? 0) * cell,
      5,
    );
    const nearly = at(timeline, fall + frames.fall - 1);
    expect((nearly.pieces[moved]?.y ?? 0) - cellY(moved)).toBeGreaterThan(
      -cell,
    );
    expect(
      timeline.steps.length === 1 ? sceneAt(timeline, timeline.length) : true,
    ).toBeNull();
  });

  it("tweens the score from what it was to what it is, and shows the swaps one fewer until the steps are done", () => {
    expect(at(timeline, 0).score).toBe(timeline.before.score);
    expect(at(timeline, 0).moves).toBe(timeline.before.moves - 1);
    const lastFrame = timeline.length - 1;
    expect(at(timeline, lastFrame).score).toBe(timeline.after.score);
    expect(at(timeline, lastFrame).moves).toBe(timeline.after.moves);
    const mids = [0, 0.5, 1].map(
      (p) =>
        at(timeline, Math.floor(frames.swap + p * (lastFrame - frames.swap)))
          .score,
    );
    expect(mids).toEqual([...mids].sort((x, y) => x - y));
  });

  it("says the praise from its frame for a while, and no longer", () => {
    const long = timelineOf(
      11,
      {},
      { cues: [{ frame: 10, praise: "TASTY!" }] },
    );
    expect(at(long, 9).praise).toBeNull();
    expect(at(long, 10).praise).toEqual({ age: 0, text: "TASTY!" });
    const tail = { ...long, length: 200 };
    expect(at(tail, 10 + praiseFrames - 1).praise).toEqual({
      age: praiseFrames - 1,
      text: "TASTY!",
    });
    expect(at(tail, 10 + praiseFrames).praise).toBeNull();
  });

  it("shakes only for a bomb or star going off, or the third step of a chain, in turns of a pixel", () => {
    expect(at(timeline, 3).shake).toBe(0);
    const fired = {
      ...timeline,
      steps: timeline.steps.map((step, index) =>
        index === 0 ? { ...step, fired: [1] } : step,
      ),
    };
    const pop = fired.pops[0] ?? 0;
    expect(Math.abs(at(fired, pop + 1).shake)).toBe(2);
    expect(at(fired, pop).shake).toBe(-at(fired, pop + 1).shake);
    expect(at(fired, pop + frames.pop + 2).shake).toBe(0);
    const third = {
      ...timeline,
      pops: [0, 20, 40],
      steps: [timeline.steps[0], timeline.steps[0], timeline.steps[0]].flatMap(
        (s) => (s === undefined ? [] : [s]),
      ),
      length: 80,
      cues: [],
    };
    expect(Math.abs(at(third, 41).shake)).toBe(1);
    expect(at(third, 21).shake).toBe(0);
  });

  it("draws frost over a frosted cell until a step clears it, and the frost is gone from the next step's pop on", () => {
    const first = timeline.steps[0];
    const target = first?.clear[0] ?? 0;
    const frosted = timelineOf(11, {
      frost: Array.from({ length: 64 }, (_, i) => i === target),
    });
    const pop = frosted.pops[0] ?? 0;
    expect(at(frosted, 0).pieces[target]?.frosted).toBe(true);
    expect(at(frosted, pop).pieces[target]?.frosted).toBe(true);
    expect(at(frosted, pop + frames.pop).pieces[target]?.frosted).toBe(false);
    expect(at(frosted, pop + 3).sparks.length).toBeGreaterThan(
      at(timeline, pop + 3).sparks.length,
    );
  });

  it("holds the board for a banner when the level is cleared, then drops the new board in from above, column by column, and ends on it", () => {
    const cleared = timelineOf(11, {}, {});
    const longer = {
      ...cleared,
      after: { ...cleared.after, levelCleared: true },
      bannerAt: cleared.length,
      length: cleared.length + frames.banner + frames.drop,
    };
    expect(at(longer, longer.bannerAt).banner).toBe(true);
    expect(at(longer, longer.bannerAt + frames.banner - 1).banner).toBe(true);
    const into = at(longer, longer.bannerAt + frames.banner + 3);
    expect(into.banner).toBe(false);
    expect(into.pieces[0]?.y).toBeLessThan(cellY(0));
    expect(into.pieces[0]?.y).toBeGreaterThan(into.pieces[7]?.y ?? 0);
    expect(at(longer, longer.length - 1).pieces[0]?.value).toBe(
      longer.after.board[0],
    );
  });

  it("shakes the old board for half a shuffle and then shows the new one", () => {
    const base = timelineOf(11);
    const shuffled = {
      ...base,
      shuffleAt: base.length,
      shuffled: true,
      length: base.length + frames.shuffle,
    };
    const early = at(shuffled, base.length);
    const late = at(shuffled, base.length + frames.shuffle / 2);
    expect(Math.abs(early.shake)).toBe(1);
    expect(late.shake).toBe(0);
    expect(late.pieces.map((p) => p.value)).toEqual([...base.after.board]);
  });

  it("rests on the board the swap left when nothing else is playing", () => {
    const rest = at(
      { ...timeline, length: timeline.length + 5 },
      timeline.length + 1,
    );
    expect(rest.pieces.map((piece) => piece.value)).toEqual([
      ...timeline.after.board,
    ]);
  });
});
