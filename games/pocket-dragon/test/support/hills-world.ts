import { freshPlasma } from "../../src/rules/plasma.ts";
import {
  groundRow,
  levelTiles,
  tile,
  worldTiles,
} from "../../src/rules/hills/constants.ts";
import { hillsRules } from "../../src/rules/hills/index.ts";
import { Layout } from "../../src/rules/hills/layout.ts";
import { secretAreas } from "../../src/rules/hills/secret-layout.ts";
import { startHills } from "../../src/rules/hills/state.ts";
import { tickHills } from "../../src/rules/hills/tick.ts";
import type {
  Cell,
  HillsControl,
  HillsLevel,
  HillsState,
  Patrol,
  Roller,
  Spot,
  Vent,
  Weather,
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
  readonly weather?: Weather;
  readonly charm?: Spot;
  readonly motes?: readonly Spot[];
  readonly burrow?: Spot;
  readonly cloudGate?: Spot;
  readonly forcefield?: Spot;
  readonly rollers?: readonly Roller[];
  readonly springs?: readonly Spot[];
  readonly vents?: readonly Vent[];
  readonly wings?: Spot;
  // The tunnel and the sky past the stage's end, as every stage has them (their walls, ceiling and cloud steps, not their eggs).
  readonly secrets?: boolean;
}

export function flatLevel(extras: Extras = {}): HillsLevel {
  const weather = extras.weather ?? "fog";
  const ice = extras.ice ?? [];
  const pits = new Set(extras.pits ?? []);
  const world = new Layout(1);
  const doors = secretAreas(world);
  const ground = Array.from(
    { length: extras.secrets === true ? worldTiles : levelTiles },
    (_, column) =>
      pits.has(column) ? 10 : (world.ground[column] ?? groundRow),
  );
  return {
    berry: extras.berry ?? far,
    burrow: extras.burrow ?? far,
    charm: extras.charm ?? far,
    checkpointX: 75 * tile,
    cloudGate: extras.cloudGate ?? far,
    eggs: extras.eggs ?? [],
    forcefield: extras.forcefield ?? far,
    gloomSpeed: 5,
    goalX: (levelTiles - 4) * tile,
    golden: extras.golden ?? far,
    ground,
    ice,
    iceAt: new Map(ice.map((cell, at) => [cell.column * 64 + cell.row, at])),
    motes: extras.motes ?? [],
    patrols: extras.patrols ?? [],
    rollers: extras.rollers ?? [],
    skyEnd: doors.skyEnd,
    skyExit: 100 * tile,
    solid: extras.secrets === true ? world.solid : new Set(),
    springs: extras.springs ?? [],
    stage: 1,
    thorns: extras.thorns ?? [],
    tunnelEnd: doors.tunnelEnd,
    tunnelExit: 76 * tile,
    vents: extras.vents ?? [],
    weather,
    wings: extras.wings ?? far,
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
    plasma: freshPlasma(level.motes),
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
