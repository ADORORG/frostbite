import { startBase } from "../../src/rules/woods/base.ts";
import {
  startWoods,
  woodsChapter,
  woodsRules,
} from "../../src/rules/woods/index.ts";
import type {
  Base,
  WoodsControl,
  WoodsState,
} from "../../src/rules/woods/types.ts";

// The woods outside the maze, for the tests: a state just out of the maze (with some of its walk changed), a press or let-go made
// through the published rules, and playing on.
export const maze = startWoods(3);

export function outside(
  changes: Partial<Base> = {},
  more: Partial<WoodsState> = {},
): WoodsState {
  return {
    ...maze,
    escapeTick: 0,
    escaped: true,
    ...more,
    base: { ...startBase(maze), ...changes },
  };
}

// The lair, begun at tick 0, with Glitchy where it is put.
export const inLair = (
  changes: Partial<Base> = {},
  more: Partial<WoodsState> = {},
): WoodsState => outside({ lairStart: 0, ...changes }, more);

export function baseOf(state: WoodsState): Base {
  if (state.base === null) throw new Error("Glitchy is still in the maze");
  return state.base;
}

export function press(
  state: WoodsState,
  control: WoodsControl,
  on = true,
): WoodsState {
  const stepped = woodsRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: control,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
}

export const playFor = (state: WoodsState, ticks: number): WoodsState =>
  woodsChapter.advanceTo(state, state.tick + ticks);
