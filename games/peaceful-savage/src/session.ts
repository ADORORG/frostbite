import type { JsonValue } from "@frostbite/game-sdk/protocol";
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
import { savageRules } from "./rules/index.ts";
import { startRun } from "./rules/state.ts";
import { advanceTo } from "./rules/tick.ts";
import type { PlayState } from "./rules/types.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

export type InputType =
  | "act"
  | "choose"
  | "end"
  | "hurry"
  | "lead"
  | "move"
  | "practice"
  | "release"
  | "vision";

// One run as the player plays it. The page calls `tick` on its timer and `input` when the player does something; the rules decide what is
// legal, and the inputs they accept (each with the tick it was made on) are written into a run record. Only inputs are recorded, never
// the ticks between them. There is no page and no clock in this module.
export interface RunSession {
  clock(): number;
  earned(): readonly string[];
  input(type: InputType, fields?: Readonly<Record<string, number>>): Outcome;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): PlayState;
  tick(): void;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as it is earned.
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
    for (const milestone of savageRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function input(
    type: InputType,
    fields: Readonly<Record<string, number>> = {},
  ): Outcome {
    if (state.ended) return finished;
    const data: Record<string, JsonValue> = { ...fields, tick: clock };
    const stepped = savageRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    recorder.input(type, data);
    state = stepped.state;
    announce();
    return { ok: true };
  }

  return {
    clock: () => clock,
    earned: () => savageRules.earned(state),
    input,
    record() {
      if (!state.ended) input("end");
      return recorder.finish(savageRules.earned(state));
    },
    state: () => state,
    tick() {
      if (state.ended) return;
      clock += 1;
      state = advanceTo(state, clock);
      announce();
      if (clock >= maxTicks) input("end");
    },
  };
}
