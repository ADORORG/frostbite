import { blockX } from "../../src/rules/block.ts";
import { towerRules } from "../../src/rules/index.ts";
import { startTower } from "../../src/rules/state.ts";
import type { TowerState } from "../../src/rules/types.ts";

// A tower with its moving block set to begin at 0 on tick 0 (the first block is slow, so on tick `t` its left edge is at `t`). What a test
// needs of the tower it names in `over`; the rest is a fresh run.
export function tower(over: Partial<TowerState> = {}): TowerState {
  return { ...startTower(7), phase: 0, startTick: 0, tick: 0, ...over };
}

// The first tick on which the moving block's left edge is `offset` units to the right of the tower's (negative: to the left); the block
// must reach it (a fast block only stops on every other unit, or every third).
export function tickFor(state: TowerState, offset: number): number {
  const sweep = (120 - state.width) * 2;
  for (
    let tick = state.startTick + 1;
    tick <= state.startTick + sweep;
    tick += 1
  )
    if (blockX(state, tick) === state.topX + offset) return tick;
  throw new Error(`the block never reaches ${String(offset)}`);
}

// Drops on the tick that gives `offset`, through the rules, and returns the state it made.
export function dropWith(state: TowerState, offset: number): TowerState {
  const stepped = towerRules.step(state, {
    data: { tick: tickFor(state, offset) },
    type: "drop",
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
}
