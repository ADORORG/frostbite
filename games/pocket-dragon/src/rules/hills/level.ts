import { gloomSpeeds, groundRow, levelTiles, tile } from "./constants.ts";
import {
  berry,
  cloud,
  doubleGap,
  gap,
  hill,
  iceWall,
  Layout,
  ledges,
  meadow,
  perch,
  thorn,
  thornCloud,
  type Stretch,
} from "./layout.ts";
import type { HillsLevel } from "./types.ts";

// A stage is laid out once, from the run's seed and the stage's number. Stage one is gentle: flat meadows, narrow pits, a few slow
// gloomlings. Stage two adds wider pits, thorn bushes and gloomlings in pairs; stage three has pits close together and the most ice. On
// every stage the fire berry comes before the first ice wall, there is one golden egg on a high ledge, and there are always enough
// eggs, gloomlings and ice blocks for every mark to be possible.
const startFlat = 8;
const endFlat = 12;
const longestStretch = 17;
const checkpointAt = 75;
const eggEvery = 6;
const gloomEvery = [30, 26, 24] as const;
const iceEvery = [60, 50, 46] as const;
const berryAt = [28, 12, 12] as const;
// The first ice wall is this far past the berry, so the fire is learned before it is needed.
const iceAfterBerry = 6;

const mixes: readonly (readonly Stretch[])[] = [
  [meadow, gap(1), gap(1), hill, ledges, thorn, cloud(1)],
  [gap(2), gap(2), doubleGap, hill, ledges, thorn, thornCloud, cloud(2)],
  [gap(2), gap(2), doubleGap, doubleGap, thorn, thornCloud, thornCloud, ledges],
];

export const stageSeed = (seed: number, stage: number): number =>
  Math.imul((seed ^ Math.imul(stage, 0x9e37_79b1)) >>> 0, 0x85eb_ca6b) >>> 0;

const pick = <Item>(list: readonly Item[], at: number, fallback: Item): Item =>
  list[at] ?? fallback;

export function generateHills(seed: number, stage = 1): HillsLevel {
  const layout = new Layout(stageSeed(seed, stage));
  const at = Math.max(0, Math.min(2, stage - 1));
  const mix = pick(mixes, at, []);
  const perchAt = 40 + layout.roll(50);
  layout.flat(0, startFlat, groundRow);
  let column = startFlat;
  let checkpoint = 0;
  let berryColumn = -1;
  let walls = 0;
  while (column < levelTiles - endFlat - longestStretch) {
    const wantWalls =
      berryColumn < 0 || column < berryColumn + iceAfterBerry
        ? 0
        : Math.floor(
            (column - berryColumn - iceAfterBerry) / pick(iceEvery, at, 24),
          ) + 1;
    if (berryColumn < 0 && column >= pick(berryAt, at, 12)) {
      berryColumn = column;
      column += berry(layout, column, groundRow);
    } else if (checkpoint === 0 && column >= checkpointAt) {
      layout.flat(column, 5, groundRow);
      checkpoint = column + 2;
      column += 5;
    } else if (layout.golden === null && column >= perchAt)
      column += perch(layout, column, groundRow);
    else if (walls < wantWalls) {
      walls += 1;
      column += iceWall(layout, column, groundRow);
    } else if (
      layout.patrols.length < Math.floor(column / pick(gloomEvery, at, 16))
    )
      column += cloud(stage > 1 ? 2 : 1)(layout, column, groundRow);
    else if (layout.eggs.length < Math.floor(column / eggEvery))
      column += meadow(layout, column, groundRow);
    else
      column += pick(mix, layout.roll(mix.length), meadow)(
        layout,
        column,
        groundRow,
      );
  }
  layout.flat(column, levelTiles - column, groundRow);
  return {
    berry: layout.berry ?? { x: 0, y: 0 },
    checkpointX: checkpoint * tile,
    eggs: layout.eggs,
    gloomSpeed: pick(gloomSpeeds, at, 5),
    goalX: (levelTiles - 4) * tile,
    golden: layout.golden ?? { x: 0, y: 0 },
    ground: layout.ground,
    ice: layout.ice,
    iceAt: new Map(
      layout.ice.map((cell, index) => [cell.column * 64 + cell.row, index]),
    ),
    patrols: layout.patrols,
    solid: layout.solid,
    stage,
    thorns: layout.thorns,
  };
}
