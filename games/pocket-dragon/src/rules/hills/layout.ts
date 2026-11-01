import { startState, stepSeed } from "@ador/game-sdk/seeded";

import {
  berrySize,
  charmSize,
  eggSize,
  gloomHeight,
  groundRow,
  worldTiles,
  pitRow,
  thornHeight,
  thornWidth,
  tile,
} from "./constants.ts";
import type { Cell, Patrol, Roller, Spot, Vent } from "./types.ts";

// A stage of Egg Hills as it is laid out, stretch by stretch. Every stretch can be crossed by a dragon who jumps at the right moment:
// a pit is one or two tiles with three flat tiles either side, a hill is one tile up, a ledge leaves room to walk under it, a thorn bush
// or a gloomling has flat ground around it, and an ice wall is three blocks high, so it is melted, never jumped. A stretch is a function
// of the layout, the column it starts at and the ground's row, and gives how many columns it took.
export class Layout {
  readonly ground: number[] = Array.from(
    { length: worldTiles },
    () => groundRow,
  );
  readonly solid = new Set<number>();
  readonly eggs: Spot[] = [];
  readonly ice: Cell[] = [];
  readonly patrols: Patrol[] = [];
  readonly rollers: Roller[] = [];
  readonly springs: Spot[] = [];
  readonly thorns: Spot[] = [];
  readonly vents: Vent[] = [];
  berry: Spot | null = null;
  burrow: Spot | null = null;
  charm: Spot | null = null;
  cloudGate: Spot | null = null;
  golden: Spot | null = null;
  skyExit = 0;
  wings: Spot | null = null;
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
  egg(column: number, row: number): void {
    this.eggs.push(centred(column, row, eggSize));
  }
  platform(column: number, row: number): void {
    this.solid.add(column * 64 + row);
  }
  flat(from: number, length: number, row: number): void {
    for (let at = from; at < from + length; at += 1) this.ground[at] = row;
  }
}

export const centred = (column: number, row: number, size: number): Spot => ({
  x: column * tile + (tile - size) / 2,
  y: row * tile + (tile - size) / 2,
});

export type Stretch = (layout: Layout, from: number, row: number) => number;

export function meadow(layout: Layout, from: number, row: number): number {
  const length = 3 + layout.roll(3);
  layout.flat(from, length, row);
  for (let at = 0; at < length - 1; at += 1) layout.egg(from + at, row - 1);
  return length;
}

function pitOf(layout: Layout, from: number, row: number, width: number): void {
  layout.flat(from + 3, width, pitRow);
  for (let at = 0; at < width + 2; at += 1)
    layout.egg(from + 2 + at, row - (at === 0 || at === width + 1 ? 1 : 2));
}

// Three flat tiles, a pit of `widest` tiles at most, three flat tiles.
export const gap =
  (widest: number): Stretch =>
  (layout, from, row) => {
    const width = 1 + layout.roll(widest);
    layout.flat(from, width + 6, row);
    pitOf(layout, from, row, width);
    return width + 6;
  };

export function doubleGap(layout: Layout, from: number, row: number): number {
  const first = 1 + layout.roll(2);
  const second = 1 + layout.roll(2);
  layout.flat(from, first + second + 9, row);
  pitOf(layout, from, row, first);
  layout.flat(from + 6 + first, second, pitRow);
  return first + second + 9;
}

export function hill(layout: Layout, from: number, row: number): number {
  const raised = 4 + layout.roll(3);
  layout.flat(from, 3, row);
  layout.flat(from + 3, raised, row - 1);
  layout.flat(from + 3 + raised, 3, row);
  for (let at = 0; at < raised; at += 1) layout.egg(from + 3 + at, row - 2);
  return raised + 6;
}

export function ledges(layout: Layout, from: number, row: number): number {
  layout.flat(from, 7, row);
  for (let at = 2; at < 5; at += 1) {
    layout.platform(from + at, row - 2);
    layout.egg(from + at, row - 3);
  }
  layout.egg(from + 5, row - 1);
  layout.egg(from + 6, row - 1);
  return 7;
}

export function thorn(layout: Layout, from: number, row: number): number {
  layout.flat(from, 6, row);
  layout.thorns.push({
    x: (from + 3) * tile + (tile - thornWidth) / 2,
    y: row * tile - thornHeight,
  });
  for (let at = 2; at < 5; at += 1) layout.egg(from + at, row - 2);
  return 6;
}

export const cloud =
  (count: number): Stretch =>
  (layout, from, row) => {
    const length = 7 + count * 2;
    layout.flat(from, length, row);
    for (let at = 0; at < count; at += 1)
      layout.patrols.push({
        maxX: (from + length - 2) * tile,
        minX: (from + 1 + at * 2) * tile,
        x: (from + 3 + at * 2) * tile,
        y: row * tile - gloomHeight,
      });
    for (let at = 0; at < 3; at += 1)
      layout.egg(from + length - 3 + at, row - 2);
    return length;
  };

export const thornCloud: Stretch = (layout, from, row) =>
  thorn(layout, from, row) + cloud(1)(layout, from + 6, row);

// A wall of three ice blocks with eggs behind it: too high to jump, so it is melted with a puff of fire.
export function iceWall(layout: Layout, from: number, row: number): number {
  layout.flat(from, 8, row);
  for (let up = 1; up <= 3; up += 1)
    layout.ice.push({ column: from + 3, row: row - up });
  for (let at = 5; at < 8; at += 1) layout.egg(from + at, row - 1);
  return 8;
}

// The fire berry, on flat ground where nobody can miss it.
export function berry(layout: Layout, from: number, row: number): number {
  layout.flat(from, 5, row);
  layout.berry = centred(from + 2, row - 1, berrySize);
  return 5;
}

// A hill with a ledge high over it and the golden egg on the ledge: jump from the hill to reach it.
export function perch(layout: Layout, from: number, row: number): number {
  layout.flat(from, 2, row);
  layout.flat(from + 2, 6, row - 1);
  layout.flat(from + 8, 2, row);
  layout.platform(from + 5, row - 3);
  layout.platform(from + 6, row - 3);
  layout.golden = centred(from + 6, row - 4, eggSize);
  layout.egg(from + 2, row - 2);
  layout.egg(from + 3, row - 2);
  return 10;
}

// The secret: cloud steps up to a high ledge where the stage's charm hides (it shows itself only when Glitchy is close).
export function secret(layout: Layout, from: number, row: number): number {
  layout.flat(from, 9, row);
  layout.platform(from + 2, row - 2);
  layout.platform(from + 3, row - 2);
  layout.platform(from + 5, row - 4);
  layout.platform(from + 6, row - 4);
  layout.charm = centred(from + 6, row - 5, charmSize);
  layout.egg(from + 2, row - 3);
  layout.egg(from + 3, row - 3);
  return 9;
}
