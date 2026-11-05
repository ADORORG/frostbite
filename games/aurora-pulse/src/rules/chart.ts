import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import {
  barTicks,
  lanes,
  leadTicks,
  slotsPerBar,
  slotTicks,
  stageBars,
} from "./constants.ts";

// One note of the chart: the tick it is due, and its lane.
export interface Note {
  readonly lane: number;
  readonly tick: number;
}

// What the chart needs to remember from bar to bar: the generator state, and the slot (counted from the start of the run) of the last note
// in each lane, so a lane is not asked for twice in a row too soon.
export interface Maker {
  readonly last: readonly number[];
  readonly rng: number;
}

export const stageOfBar = (bar: number): number =>
  Math.floor(bar / stageBars) + 1;

// How likely (in percent) a note is on a slot of a bar, by what kind of slot it is, as the stages go: the beats from the start, the half
// beats from the third stage, the quarter beats from the sixth.
export const chanceOf = (slot: number, stage: number): number => {
  if (slot % 4 === 0) return Math.min(92, 58 + 6 * stage);
  if (slot % 2 === 0)
    return stage < 3 ? 0 : Math.min(85, 15 + 10 * (stage - 3));
  return stage < 6 ? 0 : Math.min(65, 10 + 6 * (stage - 6));
};

// The chance (in percent) that a beat has a second note with it, from the fifth stage.
export const chordChance = (stage: number): number =>
  stage < 5 ? 0 : Math.min(50, 10 + 3 * (stage - 5));

// The fewest slots between two notes of one lane: four at first, and two from the eighth stage (a lane tapped twice in a row).
export const gapOf = (stage: number): number => (stage < 8 ? 4 : 2);

export const startMaker = (seed: number): Maker => ({
  last: Array.from({ length: lanes }, () => -1_000),
  rng: startState(seed),
});

// Makes bar number `bar` (counting from 0): its notes in order of tick, and the maker to go on from. The same seed makes the same chart, bar
// for bar, so a replay needs only the seed.
export function makeBar(
  maker: Maker,
  bar: number,
): { readonly maker: Maker; readonly notes: readonly Note[] } {
  const stage = stageOfBar(bar);
  let rng = maker.rng;
  const last = [...maker.last];
  const pick = (below: number): number => {
    const stepped = stepInt(rng, below);
    rng = stepped.state;
    return stepped.value;
  };
  const notes: Note[] = [];
  const place = (slot: number, lane: number): void => {
    last[lane] = bar * slotsPerBar + slot;
    notes.push({
      lane,
      tick: leadTicks + bar * barTicks + slot * slotTicks,
    });
  };
  // A lane free at this slot: not tapped within the gap before it, and not one already used at it. Tries a lane at random, then in order.
  const free = (slot: number, taken: readonly number[]): number => {
    const start = pick(lanes);
    for (let step = 0; step < lanes; step += 1) {
      const lane = (start + step) % lanes;
      const age = bar * slotsPerBar + slot - (last[lane] ?? -1_000);
      if (!taken.includes(lane) && age >= gapOf(stage)) return lane;
    }
    return -1;
  };
  for (let slot = 0; slot < slotsPerBar; slot += 1) {
    if (pick(100) >= chanceOf(slot, stage)) continue;
    const lane = free(slot, []);
    if (lane < 0) continue;
    place(slot, lane);
    if (slot % 4 === 0 && pick(100) < chordChance(stage)) {
      const second = free(slot, [lane]);
      if (second >= 0) place(slot, second);
    }
  }
  // A bar is never empty: a note on its first beat and its third.
  for (const slot of [0, 8])
    if (
      !notes.some(
        (note) => note.tick === leadTicks + bar * barTicks + slot * slotTicks,
      )
    ) {
      const lane = free(slot, []);
      if (lane >= 0) place(slot, lane);
    }
  notes.sort((a, b) => a.tick - b.tick || a.lane - b.lane);
  return { maker: { last, rng }, notes };
}
