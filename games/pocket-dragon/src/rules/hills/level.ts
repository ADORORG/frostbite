import { sortedMotes } from "../plasma.ts";
import {
  arenaTiles,
  gloomSpeeds,
  groundRow,
  levelTiles,
  pickupSize,
  tile,
} from "./constants.ts";
import {
  berry,
  centred,
  cloud,
  doubleGap,
  gap,
  hill,
  iceWall,
  Layout,
  ledges,
  meadow,
  perch,
  secret,
  thorn,
  thornCloud,
  type Stretch,
} from "./layout.ts";
import {
  burrow,
  roller,
  secretAreas,
  secretMotes,
  springs,
  vent,
} from "./secret-layout.ts";
import type { HillsLevel, Spot, Weather } from "./types.ts";

// A stage is laid out once, from the run's seed and the stage's number. Stage one is gentle: flat meadows, narrow pits, a few slow
// gloomlings. Stage two adds wider pits, thorn bushes and gloomlings in pairs; stage three has pits close together and the most ice. On
// every stage the fire berry comes before the first ice wall, there is one golden egg on a high ledge, and there are always enough
// eggs, gloomlings and ice blocks for every mark to be possible. Each stage hides a secret charm up cloud steps, has metaplasma all
// along it, its own weather (wind, then rain, then fog), and ends in the boss's arena: a flat screen under her high ledge.
const startFlat = 8;
const endFlat = arenaTiles + 4;
const longestStretch = 17;
const checkpointAt = 75;
const eggEvery = 6;
const gloomEvery = [30, 26, 24] as const;
const iceEvery = [60, 50, 46] as const;
const berryAt = [28, 12, 12] as const;
// The first ice wall is this far past the berry, so the fire is learned before it is needed.
const iceAfterBerry = 6;

const mixes: readonly (readonly Stretch[])[] = [
  [meadow, gap(1), gap(1), hill, ledges, thorn, cloud(1), vent],
  [
    gap(2),
    gap(2),
    doubleGap,
    hill,
    ledges,
    thorn,
    thornCloud,
    cloud(2),
    vent,
    roller,
  ],
  [
    gap(2),
    gap(2),
    doubleGap,
    doubleGap,
    thorn,
    thornCloud,
    thornCloud,
    ledges,
    vent,
    roller,
    roller,
  ],
];

const weathers: readonly Weather[] = ["wind", "rain", "fog"];

// Metaplasma floats one to three tiles over the ground (over a pit, as if the ground were there), with an extra mote every third tile;
// the secret areas have their own.
function motesOf(ground: readonly number[], stage: number): readonly Spot[] {
  const motes: Spot[] = [];
  for (let column = 4; column < levelTiles - 1; column += 1) {
    const top = Math.min(ground[column] ?? groundRow, groundRow);
    const lift = 1 + ((column * 5 + stage) % 3);
    motes.push({
      x: column * tile + tile / 2,
      y: (top - lift) * tile + tile / 2,
    });
    if (column % 3 === 0)
      motes.push({
        x: column * tile + tile / 4,
        y: (top - lift - 1) * tile + tile / 2,
      });
  }
  return sortedMotes([...motes, ...secretMotes()]);
}

export const stageSeed = (seed: number, stage: number): number =>
  Math.imul((seed ^ Math.imul(stage, 0x9e37_79b1)) >>> 0, 0x85eb_ca6b) >>> 0;

const pick = <Item>(list: readonly Item[], at: number, fallback: Item): Item =>
  list[at] ?? fallback;

export function generateHills(seed: number, stage = 1): HillsLevel {
  const layout = new Layout(stageSeed(seed, stage));
  const at = Math.max(0, Math.min(2, stage - 1));
  const mix = pick(mixes, at, []);
  const perchAt = 40 + layout.roll(50);
  const secretAt = 50 + layout.roll(50);
  // The burrow comes before the nest (the tunnel comes out at it), and the spring under the swirl cloud after it.
  const burrowAt = 30 + layout.roll(25);
  const springAt = checkpointAt + 17 + layout.roll(25);
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
    } else if (layout.burrow === null && column >= burrowAt)
      column += burrow(layout, column, groundRow);
    else if (layout.cloudGate === null && column >= springAt)
      column += springs(layout, column, groundRow);
    else if (layout.golden === null && column >= perchAt)
      column += perch(layout, column, groundRow);
    else if (layout.charm === null && column >= secretAt)
      column += secret(layout, column, groundRow);
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
  // DeFu's ledge, over the portal and out of reach.
  for (let at = levelTiles - 4; at < levelTiles; at += 1)
    layout.platform(at, groundRow - 5);
  const doors = secretAreas(layout);
  const nowhere = { x: 0, y: 0 };
  return {
    berry: layout.berry ?? nowhere,
    burrow: layout.burrow ?? nowhere,
    charm: layout.charm ?? nowhere,
    checkpointX: checkpoint * tile,
    cloudGate: layout.cloudGate ?? nowhere,
    eggs: layout.eggs,
    // The forcefield floats over the nest, a jump up.
    forcefield: centred(checkpoint - 1, groundRow - 2, pickupSize),
    gloomSpeed: pick(gloomSpeeds, at, 5),
    goalX: (levelTiles - 3) * tile,
    golden: layout.golden ?? nowhere,
    ground: layout.ground,
    ice: layout.ice,
    iceAt: new Map(
      layout.ice.map((cell, index) => [cell.column * 64 + cell.row, index]),
    ),
    motes: motesOf(layout.ground, stage),
    patrols: layout.patrols,
    rollers: layout.rollers,
    skyEnd: doors.skyEnd,
    skyExit: layout.skyExit,
    solid: layout.solid,
    springs: layout.springs,
    stage,
    thorns: layout.thorns,
    tunnelEnd: doors.tunnelEnd,
    tunnelExit: (checkpoint + 1) * tile,
    vents: layout.vents,
    weather: pick(weathers, at, "wind"),
    wings: layout.wings ?? nowhere,
  };
}
