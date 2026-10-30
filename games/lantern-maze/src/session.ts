import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import {
  gameId,
  verifierId,
  verifierVersion,
  type Direction,
} from "./rules/constants.ts";
import { mazeRules } from "./rules/index.ts";
import { startRun, type MazeState } from "./rules/state.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `move` when the player chooses a direction; the rules decide what is legal (a wall is
// refused and not recorded), and the steps they accept are written into a run record. There is no screen and no clock in this module.
export interface MazeSession {
  // The milestones the run has earned so far.
  earned(): readonly string[];
  move(direction: Direction): Outcome;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): MazeState;
}

export interface MazeSessionOptions {
  // Called once for each milestone the run earns, as soon as the step that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

export function createMazeSession(options: MazeSessionOptions): MazeSession {
  let state = startRun(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function apply(type: Direction | "end"): Outcome {
    const stepped = mazeRules.step(state, { type });
    if (!stepped.ok) return stepped;
    state = stepped.state;
    recorder.input(type);
    return { ok: true };
  }

  return {
    earned: () => mazeRules.earned(state),
    move(direction) {
      const outcome = apply(direction);
      if (!outcome.ok) return outcome;
      for (const milestone of mazeRules.earned(state)) {
        if (announced.has(milestone)) continue;
        announced.add(milestone);
        options.onEarned?.(milestone);
      }
      return outcome;
    },
    record() {
      if (!state.ended) apply("end");
      return recorder.finish(mazeRules.earned(state));
    },
    state: () => state,
  };
}
