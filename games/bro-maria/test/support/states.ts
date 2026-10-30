import {
  groundRow,
  levelTiles,
  playerHeight,
  tile,
} from "../../src/rules/constants.ts";
import { startRun } from "../../src/rules/state.ts";
import type { Hero, Level, State } from "../../src/rules/types.ts";

// A level with nothing in it: flat ground the whole way, a lantern halfway and a goal at the end. Tests put what they need on it.
export const flatLevel = (over: Partial<Level> = {}): Level => ({
  checkpointX: 100 * tile,
  coins: [],
  crates: [],
  goalX: (levelTiles - 4) * tile,
  ground: Array.from({ length: levelTiles }, () => groundRow),
  patrols: [],
  slimeSpeed: 6,
  solid: new Set<number>(),
  stage: 1,
  urchins: [],
  ...over,
});

// A run on that level with the hero standing at `column` tiles in.
export function onFlat(level: Level = flatLevel(), column = 10): State {
  const started = startRun(1);
  return {
    ...started,
    coinsTaken: level.coins.map(() => false),
    cratesUsed: level.crates.map(() => false),
    hero: {
      ...started.hero,
      x: column * tile,
      y: groundRow * tile - playerHeight,
    },
    level,
    slimes: level.patrols.map((patrol) => ({
      alive: true,
      dir: 1,
      x: patrol.x,
    })),
  };
}

export const withHero = (state: State, hero: Partial<Hero>): State => ({
  ...state,
  hero: { ...state.hero, ...hero },
});

export const holding = (
  state: State,
  controls: Partial<State["controls"]>,
): State => ({
  ...state,
  controls: { ...state.controls, ...controls },
});
