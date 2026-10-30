import {
  ballWidth,
  closeCallClearance,
  courseUnits,
  hopPeak,
  hopTicks,
  maxTicks,
  rockHeight,
  rockWidth,
} from "./constants.ts";
import { speedAt } from "./course.ts";
import type { SnowballState } from "./types.ts";

// How high the snowball's underside is a given number of ticks into a hop: a parabola in whole numbers, 0 on the snow.
export const heightAt = (air: number): number =>
  Math.floor((hopPeak * 4 * air * (hopTicks - air)) / (hopTicks * hopTicks));

// A run is over when the snowball has hit a rock, reached the foot of the slope, or been closed.
export const over = (state: SnowballState): boolean =>
  !state.alive || state.finished || state.ended;

// One tick: the snowball rolls on and its hop goes on, and the rock it is passing, if any, is settled. A rock whose top the
// snowball is not over while they overlap ends the run; one that has gone by is cleared (a close call when only just).
export function tickOnce(state: SnowballState): SnowballState {
  if (over(state)) return state;
  const air = state.air === 0 || state.air + 1 >= hopTicks ? 0 : state.air + 1;
  const feet = heightAt(air);
  const distance = state.distance + speedAt(state.distance);
  const rock = state.rocks[state.cleared];
  const base = { ...state, air, distance, tick: state.tick + 1 };
  if (rock === undefined) return arrive(base);
  if (distance + ballWidth > rock && distance < rock + rockWidth) {
    if (feet < rockHeight) return { ...base, alive: false };
    const clearance = feet - rockHeight;
    return arrive({
      ...base,
      lowestClearance: Math.min(state.lowestClearance ?? clearance, clearance),
    });
  }
  if (distance < rock + rockWidth) return arrive(base);
  return arrive({
    ...base,
    cleared: state.cleared + 1,
    closeCalls:
      state.closeCalls +
      (state.lowestClearance !== null &&
      state.lowestClearance <= closeCallClearance
        ? 1
        : 0),
    lowestClearance: null,
  });
}

const arrive = (state: SnowballState): SnowballState =>
  state.distance >= courseUnits ? { ...state, finished: true } : state;

// Lets the run go on to `tick` (it stops where it ends, or at the longest a run may be).
export function advanceTo(state: SnowballState, tick: number): SnowballState {
  let current = state;
  const until = Math.min(tick, maxTicks);
  while (!over(current) && current.tick < until) current = tickOnce(current);
  return current;
}
