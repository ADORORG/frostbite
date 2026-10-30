import {
  comboPerStep,
  energyFor,
  goodWindow,
  greatWindow,
  maxInputs,
  maxMultiplier,
  perfectWindow,
  pointsFor,
} from "./constants.ts";
import type { PulseState } from "./state.ts";
import { clampEnergy, spoiled } from "./tick.ts";

type Grade = "good" | "great" | "perfect";

export const gradeOf = (off: number): Grade =>
  off <= perfectWindow ? "perfect" : off <= greatWindow ? "great" : "good";

// A tap in `lane` on the tick the run is at: it hits the nearest note of that lane within `goodWindow` ticks of it (an earlier note if two are
// as near), and is judged by how far off it was; with no such note it is a stray. A hit scores the grade's points times the multiplier, adds
// to the combo and gives energy; a stray tap costs energy and ends the combo. A tap ends the run if it takes the last of the energy or is the
// last a record holds.
export function hitOnce(state: PulseState, lane: number): PulseState {
  const inputs = state.inputs + 1;
  const near = state.pending
    .filter(
      (note) =>
        note.lane === lane && Math.abs(note.tick - state.tick) <= goodWindow,
    )
    .sort(
      (a, b) =>
        Math.abs(a.tick - state.tick) - Math.abs(b.tick - state.tick) ||
        a.tick - b.tick,
    )[0];
  const base = { ...state, inputs };
  const hit =
    near === undefined
      ? spoiled(base, "stray", lane)
      : landed(base, near.tick, lane);
  return !hit.ended && inputs >= maxInputs
    ? { ...hit, cause: "spent", ended: true }
    : hit;
}

function landed(state: PulseState, due: number, lane: number): PulseState {
  const grade = gradeOf(Math.abs(due - state.tick));
  const multiplier = Math.min(
    maxMultiplier,
    1 + Math.floor(state.combo / comboPerStep),
  );
  const combo = state.combo + 1;
  const energy = clampEnergy(state.energy + energyFor[grade]);
  const perfectRun = grade === "perfect" ? state.perfectRun + 1 : 0;
  return {
    ...state,
    bestCombo: Math.max(state.bestCombo, combo),
    bestPerfects: Math.max(state.bestPerfects, perfectRun),
    combo,
    energy,
    goods: state.goods + (grade === "good" ? 1 : 0),
    greats: state.greats + (grade === "great" ? 1 : 0),
    hits: state.hits + 1,
    judged: { kind: grade, lane, tick: state.tick },
    pending: state.pending.filter(
      (note) => !(note.lane === lane && note.tick === due),
    ),
    peakEnergy: Math.max(state.peakEnergy, energy),
    perfectRun,
    perfects: state.perfects + (grade === "perfect" ? 1 : 0),
    score: state.score + pointsFor[grade] * multiplier,
  };
}
