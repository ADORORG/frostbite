import { refuse, tickNamed, withFields } from "@frostbite/game-sdk/run-inputs";
import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@frostbite/game-sdk/run-record";

import { questScore } from "../../score.ts";
import { verifierVersion } from "../constants.ts";
import { noSettings } from "../held.ts";
import { maxTicks } from "./constants.ts";
import { readKeys } from "./keys.ts";
import { questEarned } from "./milestones.ts";
import { advanceQuest, questChange, startQuest } from "./tick.ts";
import type { QuestState } from "./types.ts";

// THE WHOLE QUEST's rules: the three levels as one run. Inputs: `keys` (many presses and let-goes, written compactly; see `keys.ts`),
// each taken on its tick by the level being played as that level takes a press, and `end` `{ tick }`.
function stepKeys(
  state: QuestState,
  data: RunInput["data"],
): Stepped<QuestState> {
  return withFields(data, ["keys"], (fields) => {
    const changes = readKeys(fields.keys);
    if (typeof changes === "string") return refuse(changes);
    let current = state;
    for (const { control, gap, on } of changes) {
      const tick = current.tick + gap;
      if (tick > maxTicks)
        return refuse(`tick must be from 0 to ${String(maxTicks)}`);
      const changed = questChange(advanceQuest(current, tick), control, on);
      if (!changed.ok) return changed;
      current = changed.state;
    }
    return { ok: true, state: current };
  });
}

function stepQuest(state: QuestState, input: RunInput): Stepped<QuestState> {
  if (state.ended) return refuse("the run has ended");
  if (input.type === "keys") return stepKeys(state, input.data);
  if (input.type !== "end") return refuse(`no such input: ${input.type}`);
  return withFields(input.data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...advanceQuest(state, tick), ended: true } };
  });
}

export const questRules: GameVerifier<QuestState> = {
  earned: questEarned,
  id: "quest",
  init: (seed, config) => noSettings(config, () => startQuest(seed)),
  // The leaderboard ranks the whole quest only, by the score its result card shows. A level played alone has none, because its score
  // is on another scale and would not rank against a quest's.
  score: (state) => (state.ended ? questScore(state) : null),
  step: stepQuest,
  version: verifierVersion,
};
