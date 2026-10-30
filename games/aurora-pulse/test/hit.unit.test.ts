import { describe, expect, it } from "vitest";

import {
  greatWindow,
  goodWindow,
  maxInputs,
  maxMultiplier,
  perfectWindow,
} from "../src/rules/constants.ts";
import { gradeOf, hitOnce } from "../src/rules/hit.ts";
import { withCounts } from "./support/states.ts";

const note = (lane: number, tick: number) => ({ lane, tick });
// A state at tick 100 with the notes given pending.
const at = (
  notes: ReturnType<typeof note>[],
  more: Parameters<typeof withCounts>[0] = {},
) => withCounts({ energy: 50, pending: notes, tick: 100, ...more });

describe("a tap", () => {
  it("is judged by how far off the note it was: perfect, great or good, to the tick, early or late", () => {
    expect(
      [
        0,
        perfectWindow,
        perfectWindow + 1,
        greatWindow,
        greatWindow + 1,
        goodWindow,
      ].map(gradeOf),
    ).toEqual(["perfect", "perfect", "great", "great", "good", "good"]);
    for (const [off, grade] of [
      [-2, "perfect"],
      [3, "great"],
      [-5, "great"],
      [6, "good"],
      [-9, "good"],
    ] as const)
      expect(hitOnce(at([note(1, 100 + off)]), 1).judged?.kind).toBe(grade);
  });

  it("is a stray when no note of its lane is in reach, and the note out of reach is left", () => {
    const state = at([note(1, 100 + goodWindow + 1), note(2, 100)]);
    const stray = hitOnce(state, 1);
    expect(stray.judged).toEqual({ kind: "stray", lane: 1, tick: 100 });
    expect(stray.strays).toBe(1);
    expect(stray.pending).toHaveLength(2);
    expect(stray.energy).toBe(47);
    expect(hitOnce(at([note(2, 100)]), 1).strays).toBe(1);
    expect(hitOnce(at([note(1, 100 - goodWindow - 1)]), 1).strays).toBe(1);
    expect(hitOnce(at([note(1, 100 - goodWindow)]), 1).strays).toBe(0);
  });

  it("takes the nearest note of its lane, the earlier when two are as near, and only that one", () => {
    const state = at([note(1, 92), note(1, 104), note(1, 108)]);
    const first = hitOnce(state, 1);
    expect(first.pending).toEqual([note(1, 92), note(1, 108)]);
    const tie = hitOnce(at([note(1, 96), note(1, 104)]), 1);
    expect(tie.pending).toEqual([note(1, 104)]);
    const other = hitOnce(at([note(1, 100), note(2, 100)]), 2);
    expect(other.pending).toEqual([note(1, 100)]);
  });

  it("scores the grade's points times a multiplier of one more for each ten of the combo, to the most", () => {
    const score = (combo: number, off: number) =>
      hitOnce(at([note(0, 100 + off)], { combo }), 0).score;
    expect([
      score(0, 0),
      score(9, 0),
      score(10, 0),
      score(29, 0),
      score(30, 0),
    ]).toEqual([300, 300, 600, 900, 1_200]);
    expect([score(0, 3), score(0, 7)]).toEqual([200, 100]);
    expect(score(70, 0)).toBe(300 * maxMultiplier);
    expect(score(700, 0)).toBe(300 * maxMultiplier);
  });

  it("adds to the combo and the energy by the grade, the energy to no more than the most, and notes the peak", () => {
    const perfect = hitOnce(at([note(0, 100)], { combo: 4 }), 0);
    expect([
      perfect.combo,
      perfect.bestCombo,
      perfect.energy,
      perfect.peakEnergy,
      perfect.hits,
    ]).toEqual([5, 5, 52, 60, 1]);
    expect(hitOnce(at([note(0, 103)]), 0).energy).toBe(51);
    expect(hitOnce(at([note(0, 107)]), 0).energy).toBe(50);
    const full = hitOnce(at([note(0, 100)], { energy: 99, peakEnergy: 99 }), 0);
    expect([full.energy, full.peakEnergy]).toEqual([100, 100]);
    expect(
      hitOnce(at([note(0, 100)], { bestCombo: 30, combo: 4 }), 0).bestCombo,
    ).toBe(30);
  });

  it("counts perfects, greats and goods, and the run of perfects, which anything else breaks", () => {
    let state = at([note(0, 100), note(0, 100)]);
    state = hitOnce(state, 0);
    expect([state.perfects, state.perfectRun, state.bestPerfects]).toEqual([
      1, 1, 1,
    ]);
    const great = hitOnce({ ...state, pending: [note(1, 103)] }, 1);
    expect([
      great.greats,
      great.perfectRun,
      great.bestPerfects,
      great.perfects,
    ]).toEqual([1, 0, 1, 1]);
    const good = hitOnce({ ...state, pending: [note(1, 107)] }, 1);
    expect([good.goods, good.perfectRun]).toEqual([1, 0]);
    expect(
      hitOnce(
        { ...state, pending: [note(1, 100)], perfectRun: 4, bestPerfects: 9 },
        1,
      ).bestPerfects,
    ).toBe(9);
  });

  it("counts each tap, ends the run on the last the record holds, and on the one that takes the last energy", () => {
    expect(hitOnce(at([note(0, 100)]), 0).inputs).toBe(1);
    expect(hitOnce(at([], { inputs: 7 }), 0).inputs).toBe(8);
    const last = hitOnce(at([note(0, 100)], { inputs: maxInputs - 1 }), 0);
    expect(last.ended).toBe(true);
    expect(last.cause).toBe("spent");
    expect(
      hitOnce(at([note(0, 100)], { inputs: maxInputs - 2 }), 0).ended,
    ).toBe(false);
    const faded = hitOnce(at([], { energy: 3, inputs: maxInputs - 1 }), 0);
    expect(faded.cause).toBe("faded");
  });
});
