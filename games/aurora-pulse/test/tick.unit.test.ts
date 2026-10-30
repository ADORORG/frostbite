import { describe, expect, it } from "vitest";

import {
  barTicks,
  energyFor,
  goodWindow,
  leadTicks,
  makeAhead,
  maxTicks,
  startEnergy,
} from "../src/rules/constants.ts";
import { startRun } from "../src/rules/state.ts";
import {
  advanceTo,
  clampEnergy,
  spoiled,
  tickOnce,
} from "../src/rules/tick.ts";
import { withCounts } from "./support/states.ts";

describe("a tick", () => {
  it("makes the chart as far ahead as it should be, bar by bar, and no further", () => {
    const first = tickOnce(startRun(4));
    expect(first.tick).toBe(1);
    expect(first.nextBar).toBe(2);
    expect(leadTicks + (first.nextBar - 1) * barTicks).toBeLessThanOrEqual(
      1 + makeAhead,
    );
    expect(leadTicks + first.nextBar * barTicks).toBeGreaterThan(1 + makeAhead);
    expect(first.pending.length).toBeGreaterThan(5);
    const later = advanceTo(startRun(4), 300);
    expect(leadTicks + later.nextBar * barTicks).toBeGreaterThan(
      300 + makeAhead,
    );
  });

  it("misses a note exactly when its window has gone by, and not a tick before", () => {
    const state = startRun(4);
    const note = tickOnce(state).pending[0];
    if (note === undefined) throw new Error("no note");
    const at = advanceTo(state, note.tick + goodWindow);
    expect(at.misses).toBe(0);
    expect(at.pending).toContainEqual(note);
    const after = tickOnce(at);
    expect(after.misses).toBeGreaterThanOrEqual(1);
    expect(after.pending).not.toContainEqual(note);
    expect(after.energy).toBe(startEnergy + energyFor.miss * after.misses);
    expect(after.combo).toBe(0);
    expect(after.judged).toMatchObject({ kind: "miss", tick: after.tick });
  });

  it("fades the run when the misses take the last of the energy, and goes no further", () => {
    const faded = advanceTo(startRun(4), 3_000);
    expect(faded.ended).toBe(true);
    expect(faded.cause).toBe("faded");
    expect(faded.energy).toBe(0);
    expect(tickOnce(faded)).toBe(faded);
    expect(advanceTo(faded, 9_000).tick).toBe(faded.tick);
  });

  it("finishes the run at the last tick, when the energy has lasted", () => {
    const state = withCounts({
      energy: 100,
      nextBar: 1_000,
      tick: maxTicks - 1,
    });
    const done = tickOnce({ ...state, pending: [] });
    expect(done.tick).toBe(maxTicks);
    expect(done.cause).toBe("finished");
    expect(done.ended).toBe(true);
    expect(tickOnce({ ...state, pending: [], tick: maxTicks - 2 }).ended).toBe(
      false,
    );
  });

  it("counts a bar played clean when it is played to its end without a miss or a stray tap, and not one that had one", () => {
    const end = leadTicks + goodWindow + barTicks;
    const clean = withCounts({
      energy: 100,
      nextBar: 1_000,
      flawed: false,
      pending: [],
      tick: end - 1,
    });
    expect(tickOnce(clean).cleanBars).toBe(1);
    expect(tickOnce(clean).flawed).toBe(false);
    const flawed = tickOnce({ ...clean, flawed: true });
    expect(flawed.cleanBars).toBe(0);
    expect(flawed.flawed).toBe(false);
    expect(tickOnce({ ...clean, tick: end - 2 }).cleanBars).toBe(0);
  });
});

describe("a spoiled tap", () => {
  it("is a miss or a stray: the energy, the combo and the run of perfects go, and the bar is flawed", () => {
    const base = withCounts({ combo: 12, energy: 50, perfectRun: 7, tick: 40 });
    const miss = spoiled(base, "miss", 2);
    expect([
      miss.energy,
      miss.combo,
      miss.perfectRun,
      miss.flawed,
      miss.misses,
      miss.strays,
    ]).toEqual([44, 0, 0, true, 1, 0]);
    expect(miss.judged).toEqual({ kind: "miss", lane: 2, tick: 40 });
    const stray = spoiled(base, "stray", 1);
    expect([stray.energy, stray.misses, stray.strays]).toEqual([47, 0, 1]);
    const last = spoiled({ ...base, energy: 3 }, "stray", 0);
    expect(last.energy).toBe(0);
    expect(last.ended).toBe(true);
    expect(last.cause).toBe("faded");
  });

  it("keeps the energy between nothing and the most", () => {
    expect([-5, 0, 40, 100, 130].map(clampEnergy)).toEqual([
      0, 0, 40, 100, 100,
    ]);
  });
});
