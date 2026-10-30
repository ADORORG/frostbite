import { makeBar } from "./chart.ts";
import {
  barTicks,
  energyFor,
  goodWindow,
  leadTicks,
  makeAhead,
  maxEnergy,
  maxTicks,
} from "./constants.ts";
import type { PulseState } from "./state.ts";

export const clampEnergy = (energy: number): number =>
  Math.max(0, Math.min(maxEnergy, energy));

// What a miss or a stray tap does to the run: the energy, the combos, and a flaw in the bar being played.
export function spoiled(
  state: PulseState,
  by: "miss" | "stray",
  lane: number,
): PulseState {
  const energy = clampEnergy(state.energy + energyFor[by]);
  return {
    ...state,
    combo: 0,
    energy,
    flawed: true,
    judged: { kind: by, lane, tick: state.tick },
    misses: state.misses + (by === "miss" ? 1 : 0),
    perfectRun: 0,
    strays: state.strays + (by === "stray" ? 1 : 0),
    ...(energy === 0 ? { cause: "faded", ended: true } : {}),
  };
}

// Makes the bars of the chart that are due within `makeAhead` ticks.
function made(state: PulseState): PulseState {
  let next = state;
  while (leadTicks + next.nextBar * barTicks <= next.tick + makeAhead) {
    const bar = makeBar(next.maker, next.nextBar);
    next = {
      ...next,
      maker: bar.maker,
      nextBar: next.nextBar + 1,
      pending: [...next.pending, ...bar.notes],
    };
  }
  return next;
}

// One tick: the chart is made as far ahead as it should be, each note whose time has gone by `goodWindow` is a miss, a bar that has been
// played to its end is counted (clean if it had no miss or stray tap), and the run ends when the energy is gone or the time is up.
export function tickOnce(state: PulseState): PulseState {
  if (state.ended) return state;
  let next = made({ ...state, tick: state.tick + 1 });
  const gone = next.pending.filter(
    (note) => note.tick + goodWindow < next.tick,
  );
  if (gone.length > 0) {
    next = {
      ...next,
      pending: next.pending.filter((note) => !gone.includes(note)),
    };
    for (const note of gone) {
      next = next.ended ? next : spoiled(next, "miss", note.lane);
    }
  }
  const played = next.tick - leadTicks - goodWindow;
  if (!next.ended && played > 0 && played % barTicks === 0)
    next = {
      ...next,
      cleanBars: next.cleanBars + (next.flawed ? 0 : 1),
      flawed: false,
    };
  if (!next.ended && next.tick >= maxTicks)
    next = { ...next, cause: "finished", ended: true };
  return next;
}

// The run at tick `tick` (not before the one it is at): `tickOnce` as many times as that takes.
export function advanceTo(state: PulseState, tick: number): PulseState {
  let next = state;
  while (next.tick < tick && !next.ended) next = tickOnce(next);
  return next;
}
