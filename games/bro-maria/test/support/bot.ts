import type { RunInput } from "@frostbite/game-sdk/run-record";

import {
  maxTicks,
  pitRow,
  playerWidth,
  tile,
} from "../../src/rules/constants.ts";
import { broRules } from "../../src/rules/index.ts";
import { tickOnce } from "../../src/rules/tick.ts";
import type { State } from "../../src/rules/types.ts";

// A player with a plain plan: hold right, and jump when something is close ahead (a pit, a step, an urchin or a slime). It stands for a
// patient but unskilled player, so a level it can cross is one a person can; and the inputs it makes are a legal run record to replay.
const lookahead = 20;

function wantsJump(state: State, hop: boolean): boolean {
  if (hop && state.hero.grounded) return true;
  const { hero, level } = state;
  const front = hero.x + playerWidth;
  const here = level.ground[Math.floor((hero.x + playerWidth / 2) / tile)] ?? 0;
  const ahead = level.ground[Math.floor((front + lookahead) / tile)] ?? 0;
  if (hero.grounded && (ahead < here || ahead >= pitRow)) return true;
  const close = (x: number, width: number, reach: number): boolean =>
    x + width > hero.x && x - front < reach;
  if (level.urchins.some(({ x }) => close(x, 192, 300))) return true;
  return state.slimes.some((slime) => slime.alive && close(slime.x, 224, 340));
}

export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: State;
}

// Plays a level from its seed, choosing each tick what to hold, until the hero finishes, runs out of lives, or time runs out.
export interface Plan {
  // Hops on every landing, whether or not anything is ahead.
  readonly hop?: boolean;
  // Never jumps at all.
  readonly idle?: boolean;
  // The tick to stop at, if the hero has not finished by then.
  readonly limit?: number;
}

export function play(seed: number, plan: Plan = {}): Played {
  const started = broRules.init(seed, {});
  if (!started.ok) throw new Error(started.reason);
  return playFrom(started.state, plan);
}

// The same player, from a state it is given (the start of a stage, to play one stage on its own), until `stop` says so.
export function playFrom(
  from: State,
  plan: Plan = {},
  stop: (state: State) => boolean = () => false,
): Played {
  const { hop = false, idle = false, limit = maxTicks } = plan;
  let state = from;
  const inputs: RunInput[] = [];
  const held = { jump: false, right: false };
  let pressedAt = -10;
  while (
    state.tick < limit &&
    !state.over &&
    state.finishTick === null &&
    !stop(state)
  ) {
    // A jump is held until the hero lands, then let go of, so the next press is a new one.
    const want = {
      jump:
        !idle &&
        (state.hero.grounded
          ? wantsJump(state, hop) && !(held.jump && state.tick > pressedAt + 3)
          : held.jump),
      right: true,
    };
    for (const key of ["right", "jump"] as const) {
      if (want[key] === held[key]) continue;
      const data = { on: want[key] ? 1 : 0, tick: state.tick };
      const stepped = broRules.step(state, { data, type: key });
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped.state;
      held[key] = want[key];
      if (key === "jump" && want.jump) pressedAt = state.tick;
      inputs.push({ data, type: key });
    }
    state = tickOnce(state);
  }
  const data = { tick: state.tick };
  const closed = broRules.step(state, { data, type: "end" });
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, { data, type: "end" }], state: closed.state };
}

export const finished = (state: State): boolean => state.finishTick !== null;
