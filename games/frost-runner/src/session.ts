import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import {
  gameId,
  maxTicks,
  verifierId,
  verifierVersion,
} from "./rules/constants.ts";
import { runnerRules } from "./rules/index.ts";
import { tickOnce } from "./rules/tick.ts";
import type { RunnerState } from "./rules/types.ts";
import { startRunner } from "./rules/world.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `tick` on its timer and `jump` or `slide` when the player chooses; the rules decide
// what is legal, and the choices they accept (with the tick they were made on) are written into a run record. Only choices are
// recorded, never the ticks between them, which the rules replay. There is no screen and no clock in this module.
export interface RunSession {
  // The milestones the run has earned so far.
  earned(): readonly string[];
  jump(): Outcome;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  slide(): Outcome;
  state(): RunnerState;
  // One tick. A run that ends (the runner is stopped, or the run is as long as it may be) is closed.
  tick(): void;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as the tick that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startRunner(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of runnerRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(type: "end" | "jump" | "slide"): Outcome {
    const data = { tick: state.tick };
    const stepped = runnerRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    state = stepped.state;
    recorder.input(type, data);
    return { ok: true };
  }

  const close = (): Outcome => (state.ended ? { ok: true } : apply("end"));

  return {
    earned: () => runnerRules.earned(state),
    jump: () => (state.ended ? refusal : apply("jump")),
    record() {
      close();
      return recorder.finish(runnerRules.earned(state));
    },
    slide: () => (state.ended ? refusal : apply("slide")),
    state: () => state,
    tick() {
      if (state.ended) return;
      state = tickOnce(state);
      announce();
      if (!state.alive || state.tick >= maxTicks) close();
    },
  };
}

const refusal: Outcome = { ok: false, reason: "the run has ended" };
