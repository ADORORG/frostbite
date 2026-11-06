import { stepSeed, startState } from "@frostbite/game-sdk/seeded";

import {
  groundRow,
  levelTiles,
  pitRow,
  slimeHeight,
  tile,
  urchinHeight,
} from "./constants.ts";
import type { Coin, Crate, Patrol, Urchin } from "./types.ts";

// The ground of a level as it is laid out, stretch by stretch. Every stretch can be crossed by a hero who jumps at the right moment: a pit is
// never wider than two tiles and always has flat ground (three tiles at least) on both sides, a step is a jump, a platform is a jump up and a
// crate is bumped from below, and both leave room to walk under, and a slime or an urchin has flat ground around it. A stretch is a function
// of the layout, the column it starts at and the row of the ground, and gives how many columns it took.
export class Layout {
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

export type Stretch = (layout: Layout, from: number, row: number) => number;

export function run(layout: Layout, from: number, row: number): number {
  const length = 3 + layout.roll(4);
  layout.flat(from, length, row);
  for (let at = 0; at < length - 1; at += 1) layout.coin(from + at, row - 1);
  return length;
}

// Three flat tiles to run up on, the pit, and three flat tiles to land on, with coins in an arc over it.
export function pit(layout: Layout, from: number, row: number): number {
  const width = 1 + layout.roll(2);
  layout.flat(from, 3, row);
  layout.flat(from + 3, width, pitRow);
  layout.flat(from + 3 + width, 3, row);
  for (let at = 0; at < width + 2; at += 1)
    layout.coin(from + 2 + at, row - (at === 0 || at === width + 1 ? 1 : 2));
  return width + 6;
}

export function step(layout: Layout, from: number, row: number): number {
  const raised = 4 + layout.roll(3);
  layout.flat(from, 3, row);
  layout.flat(from + 3, raised, row - 1);
  layout.flat(from + 3 + raised, 3, row);
  for (let at = 0; at < raised; at += 1) layout.coin(from + 3 + at, row - 2);
  return 6 + raised;
}

export function platforms(layout: Layout, from: number, row: number): number {
  layout.flat(from, 7, row);
  for (let at = 2; at < 5; at += 1) {
    layout.platform(from + at, row - 2);
    layout.coin(from + at, row - 3);
  }
  for (let at = 0; at < 2; at += 1) layout.coin(from + 5 + at, row - 1);
  return 7;
}

export function crates(layout: Layout, from: number, row: number): number {
  layout.flat(from, 7, row);
  layout.crate(from + 2, row - 3);
  layout.platform(from + 3, row - 3);
  layout.crate(from + 4, row - 3);
  for (let at = 0; at < 3; at += 1) layout.coin(from + 5 + at - 1, row - 1);
  return 7;
}

export function patrol(
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

export function urchin(layout: Layout, from: number, row: number): number {
  layout.flat(from, 6, row);
  layout.urchins.push({
    x: (from + 3) * tile + 32,
    y: row * tile - urchinHeight,
  });
  for (let at = 2; at < 5; at += 1) layout.coin(from + at, row - 2);
  return 6;
}

// A pit, and an urchin on the flat ground after it, far enough on to land and take a breath before jumping again.
export function pitUrchin(layout: Layout, from: number, row: number): number {
  const width = 1 + layout.roll(2);
  layout.flat(from, 3, row);
  layout.flat(from + 3, width, pitRow);
  layout.flat(from + 3 + width, 9, row);
  layout.urchins.push({
    x: (from + 3 + width + 5) * tile + 32,
    y: row * tile - urchinHeight,
  });
  for (let at = 0; at < width + 2; at += 1)
    layout.coin(from + 2 + at, row - (at === 0 || at === width + 1 ? 1 : 2));
  return width + 12;
}

// An urchin, then a pair of slimes on the ground beyond it.
export function gauntlet(layout: Layout, from: number, row: number): number {
  layout.flat(from, 6, row);
  layout.urchins.push({
    x: (from + 3) * tile + 32,
    y: row * tile - urchinHeight,
  });
  for (let at = 2; at < 5; at += 1) layout.coin(from + at, row - 2);
  return 6 + patrol(layout, from + 6, row, 2);
}

// A climb of two tiles (a full jump), a plateau, and the drop back.
export function stair(layout: Layout, from: number, row: number): number {
  layout.flat(from, 3, row);
  layout.flat(from + 3, 4, row - 2);
  layout.flat(from + 7, 3, row);
  for (let at = 0; at < 4; at += 1) layout.coin(from + 3 + at, row - 3);
  return 10;
}

// Two pits with three tiles of ground between them.
export function doublePit(layout: Layout, from: number, row: number): number {
  const first = 1 + layout.roll(2);
  const second = 1 + layout.roll(2);
  layout.flat(from, 3, row);
  layout.flat(from + 3, first, pitRow);
  layout.flat(from + 3 + first, 3, row);
  layout.flat(from + 6 + first, second, pitRow);
  layout.flat(from + 6 + first + second, 3, row);
  for (let at = 0; at < first + 2; at += 1)
    layout.coin(from + 2 + at, row - (at === 0 || at === first + 1 ? 1 : 2));
  return 9 + first + second;
}

// Two urchins four tiles apart: a jump over the first, a landing, and a jump over the second.
export function urchinPair(layout: Layout, from: number, row: number): number {
  layout.flat(from, 13, row);
  for (const at of [4, 8])
    layout.urchins.push({
      x: (from + at) * tile + 32,
      y: row * tile - urchinHeight,
    });
  for (const at of [3, 4, 7, 8]) layout.coin(from + at, row - 2);
  return 13;
}

// A slime or two walking a stretch of their own.
export const lonePatrol: Stretch = (layout, from, row) =>
  patrol(layout, from, row, 1);
export const pairPatrol: Stretch = (layout, from, row) =>
  patrol(layout, from, row, 2);
