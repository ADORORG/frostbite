import { startState } from "@frostbite/game-sdk/seeded";

import {
  allButtons,
  inputGapTicks,
  maxTicks,
  noWay,
  wayCount,
} from "./constants.ts";
import { leadAt, leads } from "./leads.ts";
import { freshPlayer, freshTally, layOut } from "./round.ts";
import { advanceTo } from "./tick.ts";
import type { RunState } from "./types.ts";

export const startRun = (seed: number): RunState => {
  const base: RunState = {
    bolts: [],
    cages: [],
    crates: [],
    darts: [],
    ended: false,
    feats: {
      closeShave: false,
      crushed: 0,
      ducked: 0,
      hoppedOver: 0,
      lastCrystalAt: -1,
      quickPair: false,
    },
    happened: 0,
    happenings: [],
    hazardClock: 0,
    hazardRng: startState(seed ^ 0x5bd1e995),
    items: [],
    lastInputTick: -inputGapTicks,
    lead: -1,
    nextDartAt: 0,
    nextId: 0,
    nextSnowballAt: 0,
    pad: { buttons: 0, way: noWay },
    phase: "play",
    phaseTick: 0,
    player: freshPlayer(0, undefined),
    pressed: 0,
    round: 0,
    score: 0,
    seed: seed >>> 0,
    snowballs: [],
    spawned: 0,
    tallies: [
      freshTally(undefined),
      freshTally(undefined),
      freshTally(undefined),
    ],
    tick: 0,
    timeLeft: 0,
    won: false,
  };
  return { ...base, ...layOut(base, 0, undefined) };
};

export type Outcome =
  | { readonly ok: true; readonly state: RunState }
  | { readonly ok: false; readonly reason: string };
const no = (reason: string): Outcome => ({ ok: false, reason });

// The lead is the run's first input: who plays it.
export const chooseLead = (state: RunState, index: number): Outcome => {
  if (state.lead >= 0) return no("the lead is already chosen");
  const lead = leadAt(index);
  if (!Number.isInteger(index) || lead === undefined)
    return no(`the lead must be 0 to ${leads.length - 1}`);
  const player = { ...state.player, hoverLeft: lead.hoverTicks };
  const tallies = [freshTally(lead), freshTally(lead), freshTally(lead)];
  return { ok: true, state: { ...state, lead: index, player, tallies } };
};

// The hands change: a direction (or none) and the buttons held. Presses since the last change are kept for the next tick.
export const changePad = (
  state: RunState,
  tick: number,
  way: number,
  buttons: number,
): Outcome => {
  if (state.lead < 0) return no("choose a lead first");
  if (state.ended) return no("the run is over");
  if (!Number.isInteger(tick) || tick < state.tick || tick > maxTicks)
    return no(`tick must be from ${state.tick} to ${maxTicks}`);
  if (tick < state.lastInputTick + inputGapTicks)
    return no(`inputs must be at least ${inputGapTicks} ticks apart`);
  if (!Number.isInteger(way) || way < noWay || way >= wayCount)
    return no(`way must be from ${noWay} to ${wayCount - 1}`);
  if (!Number.isInteger(buttons) || buttons < 0 || buttons > allButtons)
    return no(`buttons must be from 0 to ${allButtons}`);
  if (way === state.pad.way && buttons === state.pad.buttons)
    return no("the hands did not change");
  const now = advanceTo(state, tick);
  if (now.ended) return no("the run is over");
  const pressed = now.pressed | (buttons & ~now.pad.buttons);
  return {
    ok: true,
    state: { ...now, lastInputTick: tick, pad: { buttons, way }, pressed },
  };
};

// The end: the world plays on to this tick, and the run is over there if it was not already.
export const endAt = (state: RunState, tick: number): Outcome => {
  if (state.lead < 0) return no("choose a lead first");
  if (!Number.isInteger(tick) || tick < state.tick || tick > maxTicks)
    return no(`tick must be from ${state.tick} to ${maxTicks}`);
  const now = advanceTo(state, tick);
  return {
    ok: true,
    state: now.ended ? now : { ...now, ended: true, phase: "over" },
  };
};
