import { describe, expect, it } from "vitest";

import {
  freshPlasma,
  pullPlasma,
  sortedMotes,
  type Plasma,
} from "../src/rules/plasma.ts";
import {
  charmMark,
  plasmaGoal,
  plasmaMark,
  sharedMarks,
} from "../src/rules/shared-marks.ts";

const pull = { catchWithin: 1, reach: 10, speed: 3 };
const motes = sortedMotes([
  { x: 30, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: -4 },
  { x: 12, y: 40 },
]);
const pulled = (plasma: Plasma, times: number, x = 0, y = 0): Plasma => {
  let now = plasma;
  for (let at = 0; at < times; at += 1)
    now = pullPlasma(now, motes, x, y, pull);
  return now;
};

describe("metaplasma", () => {
  it("is laid out sorted by where it is, with none of it gathered yet", () => {
    expect(motes).toEqual([
      { x: 5, y: -4 },
      { x: 5, y: 0 },
      { x: 12, y: 40 },
      { x: 30, y: 0 },
    ]);
    expect(freshPlasma(motes)).toEqual({
      drifting: [],
      gathered: 0,
      taken: [false, false, false, false],
    });
  });

  it("is left where it is, as the very same object, while Glitchy is not near any", () => {
    const fresh = freshPlasma(motes);
    expect(pullPlasma(fresh, motes, -100, 0, pull)).toBe(fresh);
    expect(pullPlasma(fresh, motes, 60, 0, pull)).toBe(fresh);
    expect(pullPlasma(fresh, motes, 20, 20, pull)).toBe(fresh);
    expect(pullPlasma(fresh, [], 0, 0, pull)).toBe(fresh);
  });

  it("drifts toward Glitchy once within reach, a few steps a tick, and is gathered when close", () => {
    const first = pulled(freshPlasma(motes), 1);
    expect(first.taken).toEqual([true, true, false, false]);
    expect(first.drifting).toEqual([
      { x: 2, y: -1 },
      { x: 2, y: 0 },
    ]);
    expect(first.gathered).toBe(0);
    const second = pulled(first, 1);
    expect(second.drifting).toEqual([]);
    expect(second.gathered).toBe(2);
    expect(pulled(second, 1)).toBe(second);
  });

  it("keeps drifting after Glitchy has moved off, and starts no mote twice", () => {
    const first = pulled(freshPlasma(motes), 1);
    const away = pullPlasma(first, motes, 0, 100, pull);
    expect(away.drifting).toEqual([
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
    expect(away.taken).toBe(first.taken);
    const later = pulled(away, 40, 0, 100);
    expect(later.gathered).toBe(2);
    expect(later.drifting).toEqual([]);
  });

  it("is gathered all at once when Glitchy is on top of it, and stays gathered", () => {
    const top = pullPlasma(freshPlasma(motes), motes, 30, 0, pull);
    expect(top.gathered).toBe(1);
    expect(top.taken).toEqual([false, false, false, true]);
    expect(pullPlasma(top, motes, 30, 0, pull)).toBe(top);
  });
});

describe("the marks every chapter can earn", () => {
  it("are the first secret charm found and a great deal of metaplasma gathered in one run", () => {
    const marks = sharedMarks<{ charms: number; plasma: number }>(
      (state) => state.charms,
      (state) => state.plasma,
    );
    const earned = (charms: number, plasma: number) =>
      marks.filter(([, test]) => test({ charms, plasma })).map(([id]) => id);
    expect(earned(0, 0)).toEqual([]);
    expect(earned(1, plasmaGoal - 1)).toEqual([charmMark]);
    expect(earned(0, plasmaGoal)).toEqual([plasmaMark]);
    expect(earned(3, 5000)).toEqual([charmMark, plasmaMark]);
  });
});
