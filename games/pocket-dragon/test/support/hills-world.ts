import {
  groundRow,
  levelTiles,
  tile,
} from "../../src/rules/hills/constants.ts";
import { hillsRules } from "../../src/rules/hills/index.ts";
import { startHills } from "../../src/rules/hills/state.ts";
import { tickHills } from "../../src/rules/hills/tick.ts";
import type {
  Cell,
  HillsControl,
  HillsLevel,
  HillsState,
  Patrol,
  Spot,
} from "../../src/rules/hills/types.ts";

// A stage of Egg Hills made by hand for the tests of the rules: flat ground from end to end with nothing on it, which each test fills
// with just what it is about (a pit, an ice wall, a gloomling). Glitchy starts where every stage starts.
const far: Spot = { x: (levelTiles - 2) * tile, y: 0 };

export interface Extras {
  readonly eggs?: readonly Spot[];
  readonly golden?: Spot;
  readonly berry?: Spot;
  readonly ice?: readonly Cell[];
  readonly patrols?: readonly Patrol[];
  readonly pits?: readonly number[];
  readonly thorns?: readonly Spot[];
}

export function flatLevel(extras: Extras = {}): HillsLevel {
  const ice = extras.ice ?? [];
  const pits = new Set(extras.pits ?? []);
  return {
    berry: extras.berry ?? far,
    checkpointX: 75 * tile,
    eggs: extras.eggs ?? [],
    gloomSpeed: 5,
    goalX: (levelTiles - 4) * tile,
    golden: extras.golden ?? far,
    ground: Array.from({ length: levelTiles }, (_, column) =>
      pits.has(column) ? 10 : groundRow,
    ),
    ice,
    iceAt: new Map(ice.map((cell, at) => [cell.column * 64 + cell.row, at])),
    patrols: extras.patrols ?? [],
    solid: new Set(),
    stage: 1,
    thorns: extras.thorns ?? [],
  };
}

export function flatHills(
  extras: Extras = {},
  state: Partial<HillsState> = {},
): HillsState {
  const level = flatLevel(extras);
  return {
    ...startHills(1),
    eggsTaken: level.eggs.map(() => false),
    glooms: level.patrols.map((patrol) => ({
      alive: true,
      cheered: -1,
      dir: 1 as const,
      x: patrol.x,
    })),
    level,
    melted: level.ice.map(() => false),
    ...state,
  };
}

export function press(
  state: HillsState,
  control: HillsControl,
  on = true,
): HillsState {
  const stepped = hillsRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: control,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
}

export function ticks(state: HillsState, count: number): HillsState {
  let now = state;
  for (let at = 0; at < count; at += 1) now = tickHills(now);
  return now;
}

// The highest Glitchy gets (the least `y`) over `count` ticks.
export function peak(state: HillsState, count: number): number {
  let now = state;
  let top = now.hero.y;
  for (let at = 0; at < count; at += 1) {
    now = tickHills(now);
    top = Math.min(top, now.hero.y);
  }
  return top;
}
