import { maxTicks } from "./constants.ts";
import { closeDraft, happen, openDraft, type Draft } from "./draft.ts";
import { stepHazards } from "./hazards.ts";
import { leadAt } from "./leads.ts";
import { levelAt } from "./levels.ts";
import { stepPlayer } from "./player.ts";
import {
  collect,
  freshTally,
  interludeOver,
  keepTime,
  layOut,
} from "./round.ts";
import type { RunState } from "./types.ts";

// One tick of the world: the player moves, the hazards move and strike, items are taken, and the clock runs. Between rounds only the
// pause runs, and then the next round is laid out.
export const tickOnce = (state: RunState): RunState => {
  const lead = leadAt(state.lead);
  if (state.ended || lead === undefined) return state;
  const draft: Draft = openDraft(state);
  draft.tick += 1;
  if (draft.phase === "interlude") {
    if (interludeOver(draft)) {
      const round = draft.round + 1;
      Object.assign(draft, layOut(closeDraft(draft), round, lead));
      draft.tallies[round] = freshTally(lead);
      happen(draft, "round-start", draft.player.x, draft.player.y, round);
    }
    draft.pressed = 0;
    return closeDraft(draft);
  }
  const level = levelAt(draft.round);
  stepPlayer(draft, lead, level);
  stepHazards(draft, lead, level);
  collect(draft, lead);
  keepTime(draft);
  draft.pressed = 0;
  if (draft.tick >= maxTicks && !draft.ended) {
    draft.ended = true;
    draft.phase = "over";
  }
  return closeDraft(draft);
};

// Plays the world forward to `tick` (or until the run ends).
export const advanceTo = (state: RunState, tick: number): RunState => {
  let current = state;
  while (current.tick < tick && !current.ended) current = tickOnce(current);
  return current;
};
