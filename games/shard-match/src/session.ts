import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";
import { matchRules } from "./rules/index.ts";
import { startRun, type MatchState } from "./rules/state.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `swap` when the player chooses two shards; the rules decide what is legal (a swap that makes
// no line is refused and not recorded), and the swaps they accept are written into a run record. There is no screen and no clock in this module.
export interface MatchSession {
  // The milestones the run has earned so far.
  earned(): readonly string[];
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): MatchState;
  // Swaps the shard in `cell` with its neighbour in `direction` (0 up, 1 right, 2 down, 3 left).
  swap(cell: number, direction: number): Outcome;
}

export interface MatchSessionOptions {
  // Called once for each milestone the run earns, as soon as the swap that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

export function createMatchSession(options: MatchSessionOptions): MatchSession {
  let state = startRun(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  return {
    earned: () => matchRules.earned(state),
    record() {
      if (!state.ended) {
        const closed = matchRules.step(state, { type: "end" });
        if (closed.ok) {
          state = closed.state;
          recorder.input("end");
        }
      }
      return recorder.finish(matchRules.earned(state));
    },
    state: () => state,
    swap(cell, direction) {
      const input = { cell, to: direction };
      const stepped = matchRules.step(state, { data: input, type: "swap" });
      if (!stepped.ok) return stepped;
      state = stepped.state;
      recorder.input("swap", input);
      for (const milestone of matchRules.earned(state)) {
        if (announced.has(milestone)) continue;
        announced.add(milestone);
        options.onEarned?.(milestone);
      }
      return { ok: true };
    },
  };
}
