import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import {
  gameId,
  inputGapTicks,
  maxTicks,
  noWay,
  verifierId,
  verifierVersion,
} from "./rules/constants.ts";
import { inputTypes, rules } from "./rules/index.ts";
import { startRun } from "./rules/state.ts";
import { tickOnce } from "./rules/tick.ts";
import type { RunState } from "./rules/types.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// One run as the player plays it. The page calls `tick` on its timer and `hands` whenever the hands change; the rules decide what is legal,
// and the changes they accept (with the tick each was made on) are written into a run record. Only changes are recorded, never the ticks
// between them, and never more often than the rules allow: changes that come too fast are held and sent together, and a press that is
// let go before it could be sent is still sent, so no hop is lost. There is no screen and no clock in this module.
export interface RunSession {
  // The tick the run is on now.
  clock(): number;
  // Who leads the run: the first input, before any other.
  choose(lead: number): Outcome;
  earned(): readonly string[];
  // The hands now: a direction (-1 for none) and the buttons held, as bits.
  hands(way: number, buttons: number): void;
  inputs(): number;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): RunState;
  // One tick of the world. A run that ends here is closed.
  tick(): void;
}

export interface RunSessionOptions {
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

// A record may hold at most 64 KB. A pad change is about 35 bytes, so a run sends at most this many: a store of them to spend on a burst
// of quick hands, filled again at a steady rate over the longest run.
const burst = 60;
const budget = 1_600;
const refill = budget / maxTicks;

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startRun(options.seed);
  let count = 0;
  let tokens = burst;
  let want = { buttons: 0, way: noWay };
  let latched = 0;
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const id of rules.earned(state)) {
      if (announced.has(id)) continue;
      announced.add(id);
      options.onEarned?.(id);
    }
  }

  function apply(type: string, data: number | number[]): Outcome {
    const stepped = rules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    recorder.input(type, data);
    state = stepped.state;
    announce();
    return { ok: true };
  }

  // Sends the hands if they differ from what the rules hold and another input is allowed now.
  function flush(): void {
    if (state.lead < 0 || state.ended) return;
    if (state.tick < state.lastInputTick + inputGapTicks || tokens < 1) return;
    const pad = state.pad;
    // A button pressed again before its letting-go was sent: send the letting-go now and the press next time.
    const again = latched & pad.buttons & ~want.buttons;
    const held = want.buttons | latched;
    const buttons = again === 0 ? held : held & ~again;
    if (buttons === pad.buttons && want.way === pad.way) {
      latched = again === 0 ? 0 : latched;
      return;
    }
    const sent = apply(inputTypes.pad, [state.tick, want.way, buttons]);
    if (!sent.ok) return;
    count += 1;
    tokens -= 1;
    latched = again;
  }

  function close(): Outcome {
    if (state.lead < 0) return { ok: false, reason: "no lead was chosen" };
    return apply(inputTypes.end, state.tick);
  }

  let closed = false;
  return {
    choose(lead) {
      if (state.lead >= 0)
        return { ok: false, reason: "the lead is already chosen" };
      return apply(inputTypes.lead, lead);
    },
    clock: () => state.tick,
    earned: () => rules.earned(state),
    hands(way, buttons) {
      latched |= buttons & ~want.buttons;
      want = { buttons, way };
    },
    inputs: () => count,
    record() {
      if (!closed) {
        closed = true;
        close();
      }
      return recorder.finish(rules.earned(state));
    },
    state: () => state,
    tick() {
      if (state.lead < 0 || state.ended) return;
      flush();
      state = tickOnce(state);
      tokens = Math.min(burst, tokens + refill);
      announce();
      if (state.ended && !closed) {
        closed = true;
        close();
      }
    },
  };
}
