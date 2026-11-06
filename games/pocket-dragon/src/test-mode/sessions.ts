import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import type { ChapterPlay } from "../chapters.ts";
import type { QuestSession } from "../quest-session.ts";
import {
  gameId,
  startHearts,
  verifierId,
  verifierVersion,
  type PlayId,
} from "../rules/constants.ts";
import { change, type Running } from "../rules/held.ts";
import { controlNamed } from "../rules/quest/keys.ts";
import { legHearts, legHolds, legUses } from "../rules/quest/legs.ts";
import {
  questChange,
  questDone,
  startQuest,
  tickQuest,
} from "../rules/quest/tick.ts";
import type { QuestState } from "../rules/quest/types.ts";
import type { Outcome, RunSession } from "../session.ts";
import { keepHearts, keepLeg } from "./keep.ts";

// A test run as the page plays it: the same rules and the same controls as a run that counts, but nothing is recorded, nothing is
// earned, the hearts are kept (`keep.ts`), and only clearing the level (or winning the quest) ends it. Its record is of nothing, and
// replays to nothing.
const taken: Outcome = { ok: true };

export const nothing = (cabinet: PlayId, seed: number): RunRecord =>
  createRunRecorder({
    config: { cabinet },
    gameId,
    seed,
    verifier: verifierId,
    verifierVersion,
  }).finish([]);

export function createTestSession<
  Control extends string,
  State extends Running<Control> & { readonly hearts: number },
>(
  play: ChapterPlay<Control, State>,
  seed: number,
  keep: (state: State) => State = (state) => state,
): RunSession<Control, State> {
  let state = play.start(seed);
  let most = state.hearts;
  return {
    earned: () => [],
    hold(control, on) {
      const known = play.chapter.controls.find((name) => name === control);
      if (known === undefined || state.ended || state.controls[known] === on)
        return taken;
      const changed = change(play.chapter, state, known, on);
      if (!changed.ok) return changed;
      state = changed.state;
      return taken;
    },
    record: () => nothing(play.id, seed),
    state: () => state,
    tick() {
      if (state.ended) return;
      const next = keep(play.tick(state));
      most = Math.max(most, next.hearts);
      state = keepHearts(next, most);
      if (play.chapter.done(state)) state = { ...state, ended: true };
    },
  };
}

// The quest takes a press just as a run that counts takes it: one while the dimension shifts, once the quest is over, for a key the
// level being played does not use, or for a key already held or let go, changes nothing.
export function createTestQuestSession(
  seed: number,
  start: QuestState = startQuest(seed),
): QuestSession {
  let most = Math.max(startHearts, legHearts(start.leg));
  let state: QuestState = { ...start, leg: keepLeg(start.leg, most) };
  return {
    earned: () => [],
    hold(name, on) {
      const control = controlNamed(name);
      if (
        control === undefined ||
        questDone(state) ||
        state.shift !== null ||
        !legUses(state.leg, name) ||
        legHolds(state.leg, name) === on
      )
        return taken;
      const changed = questChange(state, control, on);
      if (!changed.ok) return changed;
      state = changed.state;
      return taken;
    },
    record: () => nothing("quest", seed),
    state: () => state,
    tick() {
      if (state.ended) return;
      const next = tickQuest(state);
      most = Math.max(most, legHearts(next.leg));
      state = { ...next, leg: keepLeg(next.leg, most) };
      if (questDone(state)) state = { ...state, ended: true };
    },
  };
}
