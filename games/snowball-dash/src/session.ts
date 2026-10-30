import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";
import { startSnowball } from "./rules/course.ts";
import { snowballRules } from "./rules/index.ts";
import { over, tickOnce } from "./rules/tick.ts";
import type { SnowballState } from "./rules/types.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `tick` on its timer and `hop` when the player chooses; the rules decide what is
// legal, and the choices they accept (with the tick they were made on) are written into a run record. Only choices are recorded,
// never the ticks between them, which the rules replay. There is no screen and no clock in this module.
export interface RunSession {
  // The milestones the run has earned so far.
  earned(): readonly string[];
  hop(): Outcome;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): SnowballState;
  // One tick. A run that ends (a rock is hit, or the foot is reached) is closed.
  tick(): void;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as the tick that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

const refusal: Outcome = { ok: false, reason: "the run has ended" };

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startSnowball(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of snowballRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(type: "end" | "hop"): Outcome {
    const data = { tick: state.tick };
    const stepped = snowballRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    state = stepped.state;
    recorder.input(type, data);
    return { ok: true };
  }

  const close = (): Outcome => (state.ended ? { ok: true } : apply("end"));

  return {
    earned: () => snowballRules.earned(state),
    hop: () => (over(state) ? refusal : apply("hop")),
    record() {
      close();
      return recorder.finish(snowballRules.earned(state));
    },
    state: () => state,
    tick() {
      if (over(state)) return;
      state = tickOnce(state);
      announce();
      if (over(state)) close();
    },
  };
}
