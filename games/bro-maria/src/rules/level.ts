import { stepSeed, startState } from "@ador/game-sdk/seeded";

import { groundRow, levelTiles, pitRow, tile } from "./constants.ts";
import { slimeHeight, urchinHeight } from "./constants.ts";
import type { Coin, Crate, Level, Patrol, Urchin } from "./types.ts";

// A level is laid out once, from the seed, as a row of stretches of ground: flat runs with coins, pits of one or two tiles, a step up and
// down, platforms and crates a jump above the ground, slimes that patrol, and urchins to jump over. It is built so that every stretch can be
// crossed by a hero who jumps at the right moment: a pit is never wider than two tiles and always has flat ground on both sides, a step is a
// single tile, a platform is a jump up and a crate is bumped from below, and both leave room to walk under, and a slime or an urchin has flat ground around it.
const startFlat = 8;
const endFlat = 12;
// The longest stretch laid in one go (three slimes), so one that starts in time ends before the flat run to the goal.
const longestStretch = 13;
const checkpointAt = 100;
const slimeEvery = 14;
const trioAt = 50;
const crateEvery = 30;
const coinEvery = 2.6;

class Layout {
  readonly ground: number[] = Array.from(
    { length: levelTiles },
    () => groundRow,
  );
  readonly solid = new Set<number>();
  readonly coins: Coin[] = [];
  readonly crates: Crate[] = [];
  readonly patrols: Patrol[] = [];
  readonly urchins: Urchin[] = [];
  state: number;
  constructor(seed: number) {
    this.state = startState(seed);
  }
  // A whole number from 0 up to but not including `bound`.
  roll(bound: number): number {
    const step = stepSeed(this.state);
    this.state = step.state;
    return Math.floor(step.value * bound);
  }
  coin(column: number, row: number): void {
    this.coins.push({
      x: column * tile + tile / 2 - 64,
      y: row * tile + tile / 2 - 64,
    });
  }
  platform(column: number, row: number): void {
    this.solid.add(column * 64 + row);
  }
  crate(column: number, row: number): void {
    this.platform(column, row);
    this.crates.push({ x: column, y: row });
  }
  flat(from: number, length: number, row: number): void {
    for (let at = from; at < from + length; at += 1) this.ground[at] = row;
  }
}

function run(layout: Layout, from: number, row: number): number {
  const length = 3 + layout.roll(4);
  layout.flat(from, length, row);
  for (let at = 0; at < length - 1; at += 1) layout.coin(from + at, row - 1);
  return length;
}

// Three flat tiles to run up on, the pit, and three flat tiles to land on, with coins in an arc over it.
function pit(layout: Layout, from: number, row: number): number {
  const width = 1 + layout.roll(2);
  layout.flat(from, 3, row);
  layout.flat(from + 3, width, pitRow);
  layout.flat(from + 3 + width, 3, row);
  for (let at = 0; at < width + 2; at += 1)
    layout.coin(from + 2 + at, row - (at === 0 || at === width + 1 ? 1 : 2));
  return width + 6;
}

function step(layout: Layout, from: number, row: number): number {
  const raised = 4 + layout.roll(3);
  layout.flat(from, 3, row);
  layout.flat(from + 3, raised, row - 1);
  layout.flat(from + 3 + raised, 3, row);
  for (let at = 0; at < raised; at += 1) layout.coin(from + 3 + at, row - 2);
  return 6 + raised;
}

function platforms(layout: Layout, from: number, row: number): number {
  layout.flat(from, 7, row);
  for (let at = 2; at < 5; at += 1) {
    layout.platform(from + at, row - 2);
    layout.coin(from + at, row - 3);
  }
  for (let at = 0; at < 2; at += 1) layout.coin(from + 5 + at, row - 1);
  return 7;
}

function crates(layout: Layout, from: number, row: number): number {
  layout.flat(from, 7, row);
  layout.crate(from + 2, row - 3);
  layout.platform(from + 3, row - 3);
  layout.crate(from + 4, row - 3);
  for (let at = 0; at < 3; at += 1) layout.coin(from + 5 + at - 1, row - 1);
  return 7;
}

function patrol(
  layout: Layout,
  from: number,
  row: number,
  slimes: number,
): number {
  const length = 7 + slimes * 2;
  layout.flat(from, length, row);
  for (let at = 0; at < slimes; at += 1) {
    const minX = (from + 1 + at * 2) * tile;
    layout.patrols.push({
      maxX: (from + length - 2) * tile,
      minX,
      x: (from + 3 + at * 2) * tile,
      y: row * tile - slimeHeight,
    });
  }
  for (let at = 0; at < 3; at += 1)
    layout.coin(from + length - 3 + at, row - 2);
  return length;
}

function urchin(layout: Layout, from: number, row: number): number {
  layout.flat(from, 6, row);
  layout.urchins.push({
    x: (from + 3) * tile + 32,
    y: row * tile - urchinHeight,
  });
  for (let at = 2; at < 5; at += 1) layout.coin(from + at, row - 2);
  return 6;
}

const stretches = [run, pit, step, platforms, crates, urchin] as const;

export function generateLevel(seed: number): Level {
  const layout = new Layout(seed);
  layout.flat(0, startFlat, groundRow);
  let column = startFlat;
  let checkpointX = 0;
  let trio = false;
  while (column < levelTiles - endFlat - longestStretch) {
    if (checkpointX === 0 && column >= checkpointAt) {
      layout.flat(column, 5, groundRow);
      checkpointX = column + 2;
      column += 5;
      continue;
    }
    // Some things a level must have however the rolls fall, so a mark that asks for them can always be earned: the slimes, a trio of them
    // close together, the crates and the coins.
    if (layout.patrols.length < Math.floor(column / slimeEvery))
      column += patrol(layout, column, groundRow, 2);
    else if (!trio && column >= trioAt) {
      column += patrol(layout, column, groundRow, 3);
      trio = true;
    } else if (layout.crates.length < Math.floor(column / crateEvery) * 2)
      column += crates(layout, column, groundRow);
    else if (layout.coins.length < Math.floor(column / coinEvery))
      column += run(layout, column, groundRow);
    else {
      const pick = layout.roll(8);
      const stretch = stretches[pick];
      if (stretch !== undefined) column += stretch(layout, column, groundRow);
      else
        column += patrol(
          layout,
          column,
          groundRow,
          1 + (pick - stretches.length),
        );
    }
  }
  layout.flat(column, levelTiles - column, groundRow);
  return {
    checkpointX: checkpointX * tile,
    coins: layout.coins,
    crates: layout.crates,
    goalX: (levelTiles - 4) * tile,
    ground: layout.ground,
    patrols: layout.patrols,
    solid: layout.solid,
    urchins: layout.urchins,
  };
}
