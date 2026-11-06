import { createRunRecorder, type RunRecord } from "@frostbite/game-sdk/run-record";

import type { ChapterPlay } from "./chapters.ts";
import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";
import type { Running } from "./rules/held.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run of one chapter as the player plays it. The page calls `tick` on its timer and `hold` when a control is pressed or let go of;
// the chapter's rules decide what is legal, and the changes they accept (with the tick they were made on) go into a run record whose
// settings name the chapter. Only changes are recorded, never the ticks between. There is no screen and no clock in this module.
export interface RunSession<
  Control extends string,
  State extends Running<Control>,
> {
  earned(): readonly string[];
  // Presses (`on`) or lets go of a control. One the chapter does not use, or one already in that state, changes nothing.
  hold(control: string, on: boolean): Outcome;
  record(): RunRecord;
  state(): State;
  tick(): void;
}

export interface RunSessionOptions<
  Control extends string,
  State extends Running<Control>,
> {
  readonly onEarned?: (milestone: string) => void;
  readonly play: ChapterPlay<Control, State>;
  readonly seed: number;
}

const ended: Outcome = { ok: false, reason: "the run has ended" };

export function createRunSession<
  Control extends string,
  State extends Running<Control>,
>(options: RunSessionOptions<Control, State>): RunSession<Control, State> {
  const { play } = options;
  let state = play.start(options.seed);
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: { cabinet: play.id },
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of play.rules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(type: string, data: { on?: number; tick: number }): Outcome {
    const stepped = play.rules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    state = stepped.state;
    recorder.input(type, data);
    announce();
    return { ok: true };
  }

  const close = (): Outcome =>
    state.ended ? { ok: true } : apply("end", { tick: state.tick });

  return {
    earned: () => play.rules.earned(state),
    hold(control, on) {
      if (state.ended) return ended;
      const known = play.chapter.controls.find((name) => name === control);
      if (known === undefined || state.controls[known] === on)
        return { ok: true };
      return apply(known, { on: Number(on), tick: state.tick });
    },
    record() {
      close();
      return recorder.finish(play.rules.earned(state));
    },
    state: () => state,
    tick() {
      if (state.ended) return;
      state = play.tick(state);
      announce();
      if (play.chapter.done(state) || state.tick >= play.chapter.maxTicks)
        close();
    },
  };
}
