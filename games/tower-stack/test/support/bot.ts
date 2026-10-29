import type { RunInput } from "@ador/game-sdk/run-record";

import { blockX, rangeOf } from "../../src/rules/block.ts";
import { towerRules } from "../../src/rules/index.ts";
import { startTower } from "../../src/rules/state.ts";
import type { TowerState } from "../../src/rules/types.ts";

// A player that sees where the block will be on every tick of its sweep, and drops it on the tick that puts it nearest the tower, then
// lets `slip` ticks go by (or comes `slip` early) the way a hand does. With no slip it stands for the best that can be done, so a run
// it cannot get far in is a game that cannot be played; with a slip it is an ordinary player, and its inputs are a legal record to replay.
export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: TowerState;
}

// The tick, within one whole sweep from now, on which the moving block is nearest the tower.
export function bestTick(state: TowerState): number {
  const sweep = rangeOf(state.width) * 2 + 1;
  let best = state.startTick + 1;
  let nearest = Number.POSITIVE_INFINITY;
  for (
    let tick = state.startTick + 1;
    tick <= state.startTick + sweep;
    tick += 1
  ) {
    const away = Math.abs(blockX(state, tick) - state.topX);
    if (away < nearest) {
      nearest = away;
      best = tick;
    }
  }
  return best;
}

export function play(
  seed: number,
  blocks: number,
  slips: readonly number[] = [0],
): Played {
  const inputs: RunInput[] = [];
  const started = towerRules.init(seed, {});
  if (!started.ok) throw new Error("init");
  let state = started.state;
  for (let drop = 0; drop < blocks && !state.over; drop += 1) {
    const slip = slips[drop % slips.length] ?? 0;
    const tick = Math.max(state.startTick + 1, bestTick(state) + slip);
    const input = { data: { tick }, type: "drop" };
    const stepped = towerRules.step(state, input);
    if (!stepped.ok) throw new Error(stepped.reason);
    inputs.push(input);
    state = stepped.state;
  }
  const end = { data: { tick: state.tick }, type: "end" };
  const ended = towerRules.step(state, end);
  if (!ended.ok) throw new Error(ended.reason);
  inputs.push(end);
  return { inputs, state: ended.state };
}

export const fresh = (seed = 7): TowerState => startTower(seed);
