import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import { idle, pressed, released, repeated, type Direction } from "./hands.ts";
import { act } from "./rules/actions.ts";
import { advance } from "./rules/advance.ts";
import {
  gameId,
  maxKeysPerInput,
  maxTicks,
  verifierId,
  verifierVersion,
} from "./rules/constants.ts";
import { permafrostRules } from "./rules/index.ts";
import { encodeKey } from "./rules/keys.ts";
import { startRun } from "./rules/state.ts";
import type { Action, PermafrostState } from "./rules/types.ts";

// One run as the player plays it. The screen calls `tick` on its timer and `press` or `hold` as keys go down and up; the rules decide what
// each does, and the keys that did something (with the tick each was made on) are written into a run record. Only keys are recorded,
// never the ticks between them, and a held arrow is written as the presses it repeats into. There is no screen and no clock in this module.
export interface RunSession {
  clock(): number;
  earned(): readonly string[];
  // A key that acts at once. Answers whether it changed anything.
  press(action: Action): boolean;
  // An arrow or the soft drop going down (`on`) or up.
  hold(control: Direction | "soft", on: boolean): void;
  // Whether the run is over: the stack reached the top, or the run was closed.
  over(): boolean;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  state(): PermafrostState;
  // One tick.
  tick(): void;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as the tick that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

// Whether a key did anything: a move into a wall, a second hold and the like leave the piece and the soft drop as they were.
const changed = (before: PermafrostState, after: PermafrostState): boolean =>
  before.piece !== after.piece || before.softDrop !== after.softDrop;

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startRun(options.seed);
  let clock = 0;
  let lastKey = 0;
  let hands = idle;
  let record: RunRecord | null = null;
  const keys: string[] = [];
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });
  const over = (): boolean => record !== null || state.blocked;

  function announce(): void {
    for (const milestone of permafrostRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function press(action: Action): boolean {
    if (over()) return false;
    const now = advance(state, clock);
    state = act(now, action);
    announce();
    if (!changed(now, state)) return false;
    keys.push(encodeKey({ action, gap: clock - lastKey }));
    lastKey = clock;
    return true;
  }

  function close(): RunRecord {
    if (record !== null) return record;
    for (let from = 0; from < keys.length; from += maxKeysPerInput)
      recorder.input("keys", {
        keys: keys.slice(from, from + maxKeysPerInput).join(""),
      });
    recorder.input("end", { tick: clock });
    const ended = permafrostRules.step(state, {
      data: { tick: clock },
      type: "end",
    });
    if (ended.ok) state = ended.state;
    record = recorder.finish(permafrostRules.earned(state));
    return record;
  }

  return {
    clock: () => clock,
    earned: () => permafrostRules.earned(state),
    hold(control, on) {
      if (over()) return;
      if (control === "soft") {
        press(on ? "softOn" : "softOff");
        return;
      }
      if (!on) {
        hands = released(hands, control);
        return;
      }
      hands = pressed(control, clock);
      press(control);
    },
    over,
    press,
    record: close,
    state: () => state,
    tick() {
      if (over()) return;
      clock += 1;
      state = advance(state, clock);
      const again = repeated(hands, clock);
      hands = again.hands;
      if (again.fire !== null) press(again.fire);
      announce();
      if (clock >= maxTicks) close();
    },
  };
}
