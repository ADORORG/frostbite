import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";
import { pulseRules } from "./rules/index.ts";
import { startRun, type PulseState } from "./rules/state.ts";
import { tickOnce } from "./rules/tick.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The screen calls `tick` on its timer and `press` when a lane is tapped; the rules decide what a tap was, and the
// taps they accept (with the tick they were made on) are written into a run record. Only taps are recorded, never the ticks between them, which the
// rules replay; the record is closed with the tick the run had reached. There is no screen and no clock in this module.
export interface PulseSession {
  // The milestones the run has earned so far.
  earned(): readonly string[];
  // Taps a lane (0 to 3) on the tick the run is at.
  press(lane: number): Outcome;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): PulseState;
  // One tick. A run that ends (the energy is gone, or the track is played out) is closed.
  tick(): void;
}

export interface PulseSessionOptions {
  // Called once for each milestone the run earns, as soon as the tick or tap that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

export function createPulseSession(options: PulseSessionOptions): PulseSession {
  let state = startRun(options.seed);
  let closed = false;
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of pulseRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  return {
    earned: () => pulseRules.earned(state),
    press(lane) {
      const data = { lane, tick: state.tick };
      const stepped = pulseRules.step(state, { data, type: "hit" });
      if (!stepped.ok) return stepped;
      state = stepped.state;
      recorder.input("hit", data);
      announce();
      return { ok: true };
    },
    record() {
      if (!closed) {
        closed = true;
        recorder.input("end", { tick: state.tick });
      }
      return recorder.finish(pulseRules.earned(state));
    },
    state: () => state,
    tick() {
      state = tickOnce(state);
      announce();
    },
  };
}
