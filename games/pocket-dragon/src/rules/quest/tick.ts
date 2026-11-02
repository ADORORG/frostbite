import { refuse } from "@ador/game-sdk/run-inputs";
import type { Stepped } from "@ador/game-sdk/run-record";

import { chapterIds, startHearts } from "../constants.ts";
import { playOn } from "../held.ts";
import { shiftTicks } from "./constants.ts";
import type { QuestControl } from "./keys.ts";
import {
  changeLeg,
  legCleared,
  legHearts,
  legKit,
  legLost,
  startLeg,
  tickLeg,
} from "./legs.ts";
import type { QuestState } from "./types.ts";

// The quest begins in Egg Hills with three hearts. Clearing a level shifts Glitchy into the next dimension, where the next level begins
// with the hearts (and the backpack) the last one ended with; clearing the last wins the quest, and losing any level loses it.
export const startQuest = (seed: number): QuestState => ({
  ended: false,
  finishTick: null,
  leg: startLeg("hills", seed, startHearts),
  lost: false,
  past: [],
  seed,
  shift: null,
  tick: 0,
});

export const questDone = (state: QuestState): boolean =>
  state.ended || state.lost || state.finishTick !== null;

export function tickQuest(state: QuestState): QuestState {
  const tick = state.tick + 1;
  if (questDone(state)) return { ...state, tick };
  if (state.shift !== null)
    return state.shift.left > 1
      ? {
          ...state,
          shift: { ...state.shift, left: state.shift.left - 1 },
          tick,
        }
      : {
          ...state,
          leg: startLeg(
            state.shift.to,
            state.seed,
            legHearts(state.leg),
            legKit(state.leg),
          ),
          past: [...state.past, state.leg],
          shift: null,
          tick,
        };
  const leg = tickLeg(state.leg);
  if (!legCleared(leg)) return { ...state, leg, lost: legLost(leg), tick };
  const to = chapterIds[chapterIds.indexOf(leg.id) + 1];
  return to === undefined
    ? { ...state, finishTick: tick, leg, tick }
    : { ...state, leg, shift: { left: shiftTicks, to }, tick };
}

export const advanceQuest = (state: QuestState, tick: number): QuestState =>
  playOn(state, tick, tickQuest);

// A press or a let-go on the tick the quest is at. None is taken while the dimension shifts, and the next level starts with every
// control let go of.
export function questChange(
  state: QuestState,
  control: QuestControl,
  on: boolean,
): Stepped<QuestState> {
  if (questDone(state)) return refuse("the run is over");
  if (state.shift !== null) return refuse("the dimension is shifting");
  const changed = changeLeg(state.leg, control, on);
  return changed.ok
    ? { ok: true, state: { ...state, leg: changed.state } }
    : changed;
}
