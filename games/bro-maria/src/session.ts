import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import {
  gameId,
  maxTicks,
  verifierId,
  verifierVersion,
} from "./rules/constants.ts";
import { broRules } from "./rules/index.ts";
import { tickOnce } from "./rules/tick.ts";
import type { Controls, State } from "./rules/types.ts";
import { startRun } from "./rules/state.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `tick` on its timer and `hold` when a key is pressed or let go of; the rules decide what
// is legal, and the changes they accept (with the tick they were made on) are written into a run record. Only changes are recorded, never the
// ticks between them, which the rules replay. There is no screen and no clock in this module.
export interface RunSession {
  // The milestones the run has earned so far.
  earned(): readonly string[];
  // Presses (`on`) or lets go of a control. A control already in that state changes nothing and is not recorded.
  hold(control: keyof Controls, on: boolean): Outcome;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): State;
  // One tick. A run that is lost or won, or as long as it may be, is closed.
  tick(): void;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as the tick that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

const finished: Outcome = { ok: false, reason: "the run has ended" };

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startRun(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of broRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(
    type: "end" | keyof Controls,
    data: { on?: number; tick: number },
  ): Outcome {
    const stepped = broRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    state = stepped.state;
    recorder.input(type, data);
    return { ok: true };
  }

  const close = (): Outcome =>
    state.ended ? { ok: true } : apply("end", { tick: state.tick });

  return {
    earned: () => broRules.earned(state),
    hold(control, on) {
      if (state.ended) return finished;
      if (state.controls[control] === on) return { ok: true };
      return apply(control, { on: Number(on), tick: state.tick });
    },
    record() {
      close();
      return recorder.finish(broRules.earned(state));
    },
    state: () => state,
    tick() {
      if (state.ended) return;
      state = tickOnce(state);
      announce();
      if (state.over || state.finishTick !== null || state.tick >= maxTicks)
        close();
    },
  };
}
