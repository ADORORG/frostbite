import { describe, expect, it } from "vitest";

import {
  chanceOf,
  chordChance,
  gapOf,
  makeBar,
  stageOfBar,
  startMaker,
  type Maker,
  type Note,
} from "../src/rules/chart.ts";
import {
  barTicks,
  lanes,
  leadTicks,
  slotTicks,
} from "../src/rules/constants.ts";

// The first `bars` bars of the chart of a seed.
function chart(seed: number, bars: number): Note[][] {
  let maker: Maker = startMaker(seed);
  const made: Note[][] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const next = makeBar(maker, bar);
    maker = next.maker;
    made.push([...next.notes]);
  }
  return made;
}

describe("the stages and what they ask", () => {
  it("are eight bars long", () => {
    expect([0, 7, 8, 15, 16, 80].map(stageOfBar)).toEqual([1, 1, 2, 2, 3, 11]);
  });

  it("put notes on the beats from the start, the half beats from the third stage and the quarter beats from the sixth, more as the stages go", () => {
    expect([1, 2, 6, 7, 30].map((stage) => chanceOf(0, stage))).toEqual([
      64, 70, 92, 92, 92,
    ]);
    expect([1, 2, 3, 4, 8, 20].map((stage) => chanceOf(2, stage))).toEqual([
      0, 0, 15, 25, 65, 85,
    ]);
    expect([1, 5, 6, 7, 12, 30].map((stage) => chanceOf(1, stage))).toEqual([
      0, 0, 10, 16, 46, 65,
    ]);
  });

  it("have chords from the fifth stage, and a lane may be asked for twice in a row closer from the eighth", () => {
    expect([1, 4, 5, 6, 10, 40].map(chordChance)).toEqual([
      0, 0, 10, 13, 25, 50,
    ]);
    expect([1, 7, 8, 30].map(gapOf)).toEqual([4, 4, 2, 2]);
  });
});

describe("a chart", () => {
  it("is the same for the same seed, and different for another", () => {
    expect(chart(5, 20)).toEqual(chart(5, 20));
    expect(chart(5, 20)).not.toEqual(chart(6, 20));
  });

  it("keeps every note inside its bar, in lanes 0 to 3, in order, and never leaves a bar empty", () => {
    const bars = chart(11, 120);
    bars.forEach((notes, bar) => {
      expect(notes.length).toBeGreaterThanOrEqual(1);
      for (const note of notes) {
        expect(note.lane).toBeGreaterThanOrEqual(0);
        expect(note.lane).toBeLessThan(lanes);
        expect(note.tick).toBeGreaterThanOrEqual(leadTicks + bar * barTicks);
        expect(note.tick).toBeLessThan(leadTicks + (bar + 1) * barTicks);
        expect((note.tick - leadTicks) % slotTicks).toBe(0);
      }
      expect(notes.map((note) => note.tick)).toEqual(
        [...notes.map((note) => note.tick)].sort((a, b) => a - b),
      );
    });
  });

  it("has at most two notes on a tick, in different lanes", () => {
    for (const notes of chart(3, 200)) {
      const ticks = new Map<number, number[]>();
      for (const note of notes)
        ticks.set(note.tick, [...(ticks.get(note.tick) ?? []), note.lane]);
      for (const lanesHere of ticks.values()) {
        expect(lanesHere.length).toBeLessThanOrEqual(2);
        expect(new Set(lanesHere).size).toBe(lanesHere.length);
      }
    }
  });

  it("keeps a lane's notes a fair way apart: four slots, and two from the eighth stage", () => {
    const bars = chart(9, 200);
    const last = [-1_000, -1_000, -1_000, -1_000];
    bars.forEach((notes, bar) => {
      for (const note of notes) {
        const slot = Math.round((note.tick - leadTicks) / slotTicks);
        const gap = slot - (last[note.lane] ?? -1_000);
        expect(gap).toBeGreaterThanOrEqual(gapOf(stageOfBar(bar)));
        last[note.lane] = slot;
      }
    });
  });

  it("is only the beats in the first two stages, has no chords before the fifth, and gets busier stage by stage", () => {
    const bars = chart(2, 8 * 14);
    const perStage = (stage: number) =>
      bars.slice((stage - 1) * 8, stage * 8).flat();
    for (const stage of [1, 2])
      for (const note of perStage(stage))
        expect(((note.tick - leadTicks) / slotTicks) % 4).toBe(0);
    for (const stage of [1, 2, 3, 4]) {
      const ticks = perStage(stage).map((note) => note.tick);
      expect(new Set(ticks).size).toBe(ticks.length);
    }
    const density = [1, 3, 6, 10, 14].map((stage) => perStage(stage).length);
    for (let at = 1; at < density.length; at += 1)
      expect(density[at]).toBeGreaterThan(density[at - 1] ?? 0);
  });
});
