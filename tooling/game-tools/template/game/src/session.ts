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
import { starterRules } from "./rules/index.ts";
import { advance, startRun } from "./rules/state.ts";
import type { StarterState } from "./rules/types.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `tick` on its timer and `tap` when the player chooses; the rules decide what is legal, and
// the taps they accept (with the tick each was made on) are written into a run record. Only choices are recorded, never the ticks between
// them. There is no screen and no clock in this module.
export interface RunSession {
  // The tick the run is on now.
  clock(): number;
  // The milestones the run has earned so far.
  earned(): readonly string[];
  // Where the marker is now.
  markerAt(): number;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): StarterState;
  // One tick. A run that is as long as it may be is closed.
  tick(): void;
  tap(): Outcome;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as the tap that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

const finished: Outcome = { ok: false, reason: "the run has ended" };

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startRun(options.seed);
  let clock = 0;
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of starterRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(type: "end" | "tap"): Outcome {
    const data = { tick: clock };
    const stepped = starterRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    recorder.input(type, data);
    state = stepped.state;
    announce();
    return { ok: true };
  }

  const close = (): Outcome => (state.ended ? { ok: true } : apply("end"));

  return {
    clock: () => clock,
    earned: () => starterRules.earned(state),
    markerAt: () => advance(state, clock).position,
    record() {
      close();
      return recorder.finish(starterRules.earned(state));
    },
    state: () => state,
    tap() {
      if (state.ended) return finished;
      return apply("tap");
    },
    tick() {
      if (state.ended) return;
      clock += 1;
      if (clock >= maxTicks) close();
    },
  };
}
