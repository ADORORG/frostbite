import type { RunInput } from "@frostbite/game-sdk/run-record";

import { dropRules } from "../../src/rules/index.ts";
import { startDrop, type DropState } from "../../src/rules/state.ts";

// A player with a plain plan: keep the big tiles in a corner by sliding down and left whenever that does anything, and right or up only
// when it must. It stands for a decent player, so a milestone it can reach is one a person can; and the inputs it makes are a legal
// run record to replay.
const preference = ["down", "left", "right", "up"] as const;

export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: DropState;
}

export function play(seed: number, moves: number): Played {
  let state = startDrop(seed);
  const inputs: RunInput[] = [];
  while (!state.over && state.moves < moves) {
    const move = preference
      .map((type) => ({ stepped: dropRules.step(state, { type }), type }))
      .find(({ stepped }) => stepped.ok);
    if (move === undefined || !move.stepped.ok) break;
    state = move.stepped.state;
    inputs.push({ type: move.type });
  }
  const closed = dropRules.step(state, { type: "end" });
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, { type: "end" }], state: closed.state };
}
