import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import {
  frostbiteGameId,
  frostbiteVerifierId,
  frostbiteVerifierVersion,
  snakeCabinetName,
} from "../verifier/frostbite.ts";
import type { Direction } from "../verifier/snake-board.ts";
import {
  moveOnce,
  snakeRules,
  startSnake,
  type SnakeState,
} from "../verifier/snake.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run of SAT SNAKE as the player plays it. The screen calls `tick` on its timer and `turn` when the player steers; the
// platform's own rules decide what is legal, and the choices they accept (with the tick they were made on) are written into
// a run record. Only choices are recorded, never the moves between them, which the rules can replay. There is no screen and
// no clock in this module.
export interface SnakeSession {
  earned(): readonly string[];
  // Closes the run if it is still going (the record needs the closing step for the last stretch to count) and returns it.
  record(): RunRecord;
  state(): SnakeState;
  // The choices recorded so far, the closing step included.
  steps(): number;
  // One move. A snake that dies ends the run.
  tick(): void;
  turn(direction: Direction): Outcome;
}

export interface SnakeSessionOptions {
  // Called once for each milestone the run earns, as soon as the move that earned it is made.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

export function createSnakeSession(options: SnakeSessionOptions): SnakeSession {
  let state = startSnake(options.seed);
  let steps = 0;
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: { cabinet: snakeCabinetName },
    gameId: frostbiteGameId,
    seed: options.seed,
    verifier: frostbiteVerifierId,
    verifierVersion: frostbiteVerifierVersion,
  });

  function announce(): void {
    for (const milestone of snakeRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(
    type: "end" | "turn",
    data: Record<string, string | number>,
  ): Outcome {
    const stepped = snakeRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    state = stepped.state;
    steps += 1;
    recorder.input(type, data);
    return { ok: true };
  }

  const close = (): Outcome =>
    state.ended ? { ok: true } : apply("end", { tick: state.tick });

  return {
    earned: () => snakeRules.earned(state),
    record() {
      close();
      return recorder.finish(snakeRules.earned(state));
    },
    state: () => state,
    steps: () => steps,
    tick() {
      if (state.ended) return;
      state = moveOnce(state);
      announce();
      if (!state.alive) close();
    },
    turn(direction) {
      // Pointing the way it already goes changes nothing, so it is not a choice to record.
      if (direction === state.planned) return { ok: true };
      return apply("turn", { dir: direction, tick: state.tick });
    },
  };
}
