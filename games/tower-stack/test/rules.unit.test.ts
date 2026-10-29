import { describe, expect, it } from "vitest";

import {
  baseWidth,
  fieldWidth,
  growBy,
  maxTicks,
  perfectTolerance,
} from "../src/rules/constants.ts";
import { dropAt } from "../src/rules/drop.ts";
import { towerRules } from "../src/rules/index.ts";
import { startTower } from "../src/rules/state.ts";
import { dropWith, tickFor, tower } from "./support/states.ts";

describe("a fresh run", () => {
  it("starts with the first block in the middle of the field, nothing stacked and nothing earned", () => {
    const run = startTower(7);
    expect(run.width).toBe(baseWidth);
    expect(run.topX).toBe((fieldWidth - baseWidth) / 2);
    expect([run.height, run.perfects, run.streak, run.tick]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(towerRules.earned(run)).toEqual([]);
  });

  it("is the same for the same seed, and begins its first block elsewhere for another", () => {
    expect(startTower(7)).toEqual(startTower(7));
    const phases = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => startTower(seed).phase),
    );
    expect(phases.size).toBeGreaterThan(4);
    for (const phase of phases)
      expect(phase).toBeLessThan((fieldWidth - baseWidth) * 2);
  });
});

describe("a drop", () => {
  const base = tower();

  it.each([-perfectTolerance, 0, perfectTolerance])(
    "is perfect %i units off the tower: nothing is cut, the block snaps into place and the streak begins",
    (offset) => {
      const next = dropWith(base, offset);
      expect([next.width, next.topX]).toEqual([base.width, base.topX]);
      expect([next.height, next.perfects, next.streak]).toEqual([1, 1, 1]);
    },
  );

  it("cuts what hangs over to the right, and the tower keeps its left edge", () => {
    const next = dropWith(base, perfectTolerance + 1);
    expect(next.width).toBe(base.width - perfectTolerance - 1);
    expect(next.topX).toBe(base.topX + perfectTolerance + 1);
    expect([next.perfects, next.streak]).toEqual([0, 0]);
  });

  it("cuts what hangs over to the left, and the tower keeps its right edge", () => {
    const next = dropWith(base, -(perfectTolerance + 1));
    expect(next.width).toBe(base.width - perfectTolerance - 1);
    expect(next.topX).toBe(base.topX);
  });

  it("ends the run when the block lands beside the tower and not on it, and survives by one unit", () => {
    const left = tower({ topX: 0 });
    const miss = dropAt(left, tickFor(left, left.width));
    expect(miss.over).toBe(true);
    expect(miss.height).toBe(0);
    const caught = dropWith(left, left.width - 1);
    expect(caught.over).toBe(false);
    expect(caught.width).toBe(1);
    expect(caught.byHair).toBe(true);
    const two = dropWith(left, left.width - 2);
    expect([two.width, two.byHair]).toEqual([2, false]);
  });

  it("begins the next block on the tick of the drop, at the speed of the new height, from the seeded generator", () => {
    const next = dropWith(base, 0);
    expect(next.startTick).toBe(tickFor(base, 0));
    expect(next.tick).toBe(next.startTick);
    expect(next.generator).not.toBe(base.generator);
    expect(next.phase).toBeLessThan((fieldWidth - next.width) * 2);
    expect(dropWith(base, 0)).toEqual(next);
  });

  it("grows the block back after a streak of perfect drops, never past the width it began with, and keeps it in the field", () => {
    const narrow = tower({ streak: 2, topX: 70, width: 46 });
    const grown = dropWith(narrow, 0);
    expect(grown.width).toBe(baseWidth);
    expect(grown.topX).toBe(70 - 1);
    expect(grown.regrown).toBe(true);
    const wide = tower({ streak: 5, topX: 70, width: 40 });
    expect(dropWith(wide, 0).width).toBe(40 + growBy);
    const edge = tower({ streak: 2, topX: 71, width: 44 });
    const kept = dropWith(edge, 0);
    expect(kept.topX + kept.width).toBeLessThanOrEqual(fieldWidth);
    expect(dropWith(tower({ streak: 1, width: 44, topX: 40 }), 0).width).toBe(
      44,
    );
    const full = dropWith(tower({ streak: 9 }), 0);
    expect([full.width, full.regrown]).toEqual([baseWidth, false]);
  });

  it("counts a streak of five once, when it reaches five, and the best streak", () => {
    const four = tower({ bestStreak: 4, streak: 4 });
    const five = dropWith(four, 0);
    expect([five.fives, five.bestStreak]).toEqual([1, 5]);
    const six = dropWith(five, 0);
    expect([six.fives, six.bestStreak]).toEqual([1, 6]);
    const broken = dropWith(six, 4);
    expect([broken.streak, broken.bestStreak]).toEqual([0, 6]);
  });
});

describe("what stands a run apart", () => {
  it("notes a narrow needle, a wide load, a tidy tower and a long run, once each has happened, and keeps it", () => {
    const needle = dropWith(tower({ height: 14, width: 8, topX: 40 }), 4);
    expect([needle.width, needle.needle]).toEqual([4, true]);
    expect(dropWith(tower({ height: 14, width: 9, topX: 40 }), 4).needle).toBe(
      false,
    );
    expect(
      dropWith(tower({ height: 29, topX: 36, width: 40 }), 0).wideLoad,
    ).toBe(true);
    expect(
      dropWith(tower({ height: 29, topX: 36, width: 29 }), 0).wideLoad,
    ).toBe(false);
    expect(dropWith(tower({ height: 19, perfects: 14 }), 0).tidy).toBe(true);
    expect(dropWith(tower({ height: 19, perfects: 13 }), 0).tidy).toBe(false);
    const kept = dropWith(
      {
        ...needle,
        height: 99,
        phase: 0,
        startTick: 0,
        tick: 0,
        topX: 40,
        width: 20,
      },
      4,
    );
    expect(kept.needle).toBe(true);
  });

  it("notes a drop on the 5,400th tick or after, not before", () => {
    const late = tower({ phase: 0, startTick: 5_390, width: 48, topX: 36 });
    expect(dropAt(late, 5_399 + 0).marathon).toBe(false);
    expect(dropAt({ ...late, phase: 0 }, 5_400).marathon).toBe(true);
  });
});

describe("the rules as a verifier", () => {
  const started = (seed = 7) => {
    const run = towerRules.init(seed, {});
    if (!run.ok) throw new Error("init");
    return run.state;
  };
  const step = (
    state: ReturnType<typeof started>,
    type: string,
    data?: object,
  ) =>
    towerRules.step(
      state,
      data === undefined ? { type } : ({ data, type } as never),
    );

  it("starts from a seed and no settings", () => {
    expect(towerRules.init(5, {}).ok).toBe(true);
    expect(towerRules.init(5, { size: 5 })).toEqual({
      ok: false,
      reason: "no such setting: size",
    });
  });

  it("drops a block on the tick it is given", () => {
    const state = started();
    const next = step(state, "drop", { tick: 20 });
    expect(
      (next.ok && next.state.height === 1) || (next.ok && next.state.over),
    ).toBe(true);
  });

  it("refuses what is not a drop: an unknown input, a tick that is missing, not whole, past, out of the run, or the tick the block appeared on", () => {
    const state = started();
    expect(step(state, "jump", { tick: 5 })).toEqual({
      ok: false,
      reason: "no such input: jump",
    });
    expect(step(state, "drop")).toMatchObject({ ok: false });
    expect(step(state, "drop", { tick: 1.5 })).toEqual({
      ok: false,
      reason: "tick must be a whole number",
    });
    expect(step(state, "drop", { tick: -1 })).toMatchObject({ ok: false });
    expect(step(state, "drop", { tick: maxTicks + 1 })).toMatchObject({
      ok: false,
    });
    expect(step(state, "drop", { tick: 0 })).toEqual({
      ok: false,
      reason: "a block cannot be dropped on the tick it appears",
    });
    expect(step(state, "drop", { extra: 1, tick: 9 })).toMatchObject({
      ok: false,
    });
    const later = { ...state, startTick: 30, tick: 30 };
    expect(step(later, "drop", { tick: 12 })).toEqual({
      ok: false,
      reason: "tick 12 is already past",
    });
  });

  it("allows a drop on the last tick of the longest run", () => {
    const state = { ...started(), startTick: maxTicks - 1, tick: maxTicks - 1 };
    expect(step(state, "drop", { tick: maxTicks }).ok).toBe(true);
  });

  it("allows only the end once the tower has fallen, and nothing after the end", () => {
    const fallen = dropAt(tower({ topX: 0 }), 60);
    expect(step(fallen, "drop", { tick: fallen.tick + 1 })).toEqual({
      ok: false,
      reason: "the tower has fallen",
    });
    const ended = step(fallen, "end", { tick: fallen.tick });
    expect(ended.ok && ended.state.ended).toBe(true);
    if (!ended.ok) return;
    expect(step(ended.state, "drop", { tick: 99 })).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(step(ended.state, "end", { tick: 99 })).toMatchObject({ ok: false });
  });

  it("ends a run on a tick that is not before the last choice, and refuses an end with no tick", () => {
    const state = started();
    const ended = step(state, "end", { tick: 40 });
    expect(ended.ok && ended.state.tick).toBe(40);
    expect(step(state, "end")).toMatchObject({ ok: false });
    expect(step({ ...state, tick: 50 }, "end", { tick: 10 })).toMatchObject({
      ok: false,
    });
  });
});
