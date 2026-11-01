import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";
import { maxTicks } from "./rules/quest/constants.ts";
import { controlNamed, letterOf, mostKeys } from "./rules/quest/keys.ts";
import { legHolds, legUses } from "./rules/quest/legs.ts";
import { questEarned } from "./rules/quest/milestones.ts";
import {
  questChange,
  questDone,
  startQuest,
  tickQuest,
} from "./rules/quest/tick.ts";
import type { QuestState } from "./rules/quest/types.ts";
import type { Outcome } from "./session.ts";

// The whole quest as the player plays it, like a chapter's session (`session.ts`) but recorded compactly: the changes the rules accept
// are written into `keys` inputs, `mostKeys` at a time, each as the ticks since the change before it and a letter. The rules take a
// change here exactly as they take it on replay. A change the level being played has no use for, or one made while the dimension shifts,
// changes nothing and is not recorded.
export interface QuestSession {
  earned(): readonly string[];
  hold(control: string, on: boolean): Outcome;
  record(): RunRecord;
  state(): QuestState;
  tick(): void;
}

export interface QuestSessionOptions {
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

const taken: Outcome = { ok: true };

export function createQuestSession(options: QuestSessionOptions): QuestSession {
  let state = startQuest(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: { cabinet: "quest" },
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });
  let keys = "";
  let written = 0;
  // The tick of the last change written: the next is written as the ticks since it.
  let last = 0;

  function flush(): void {
    if (written === 0) return;
    recorder.input("keys", { keys });
    keys = "";
    written = 0;
  }

  function announce(): void {
    for (const milestone of questEarned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function close(): void {
    if (state.ended) return;
    flush();
    recorder.input("end", { tick: state.tick });
    state = { ...state, ended: true };
  }

  return {
    earned: () => questEarned(state),
    hold(name, on) {
      const control = controlNamed(name);
      const letter = letterOf(name, on);
      if (
        control === undefined ||
        letter === undefined ||
        questDone(state) ||
        state.shift !== null ||
        !legUses(state.leg, name) ||
        legHolds(state.leg, name) === on
      )
        return taken;
      const changed = questChange(state, control, on);
      if (!changed.ok) return changed;
      state = changed.state;
      keys += `${String(state.tick - last)}${letter}`;
      last = state.tick;
      written += 1;
      if (written >= mostKeys) flush();
      announce();
      return taken;
    },
    record() {
      close();
      return recorder.finish(questEarned(state));
    },
    state: () => state,
    tick() {
      if (state.ended) return;
      state = tickQuest(state);
      announce();
      if (questDone(state) || state.tick >= maxTicks) close();
    },
  };
}
