import {
  gloomHeight,
  groundRow,
  levelTiles,
  pickupSize,
  pitRow,
  rollerSize,
  secretTiles,
  skyStart,
  springHeight,
  springWidth,
  tile,
  tunnelStart,
  ventEvery,
  ventWidth,
  wallRow,
  worldTiles,
} from "./constants.ts";
import { centred, type Layout } from "./layout.ts";
import type { Spot } from "./types.ts";

// The new stretches of a stage (a burrow, a spring under the swirl cloud, a steam vent, a rolling boulder) and its two secret areas.
// Each stretch is crossed the same way as the others: flat ground around what is in it.

// A crack in the ground with a little mound beside it: press down on it to dig into the tunnel. It shows itself only up close.
export function burrow(layout: Layout, from: number, row: number): number {
  layout.flat(from, 6, row);
  layout.burrow = { x: (from + 3) * tile, y: row * tile };
  layout.egg(from + 1, row - 1);
  layout.egg(from + 5, row - 1);
  return 6;
}

// A spring mushroom under the swirl cloud (bounce on it to reach the sky), with the wings floating just before it. The sky comes down
// again at the end of this stretch.
export function springs(layout: Layout, from: number, row: number): number {
  layout.flat(from, 10, row);
  layout.springs.push({
    x: (from + 5) * tile + (tile - springWidth) / 2,
    y: row * tile - springHeight,
  });
  layout.cloudGate = { x: (from + 5) * tile, y: tile };
  layout.wings = centred(from + 2, row - 2, pickupSize);
  layout.skyExit = (from + 8) * tile;
  return 10;
}

// A steam vent that puffs on and off: wait for it, then cross.
export function vent(layout: Layout, from: number, row: number): number {
  layout.flat(from, 7, row);
  layout.vents.push({
    phase: layout.roll(ventEvery),
    x: (from + 3) * tile + (tile - ventWidth) / 2,
    y: row * tile,
  });
  layout.egg(from + 1, row - 1);
  layout.egg(from + 5, row - 1);
  return 7;
}

// A boulder rolling to and fro: jump it (or land on it to bounce) and catch the eggs over it.
export function roller(layout: Layout, from: number, row: number): number {
  layout.flat(from, 10, row);
  layout.rollers.push({
    maxX: (from + 8) * tile,
    minX: (from + 2) * tile,
    phase: layout.roll(12 * tile),
    y: row * tile - rollerSize,
  });
  for (let at = 3; at < 8; at += 1) layout.egg(from + at, row - 3);
  return 10;
}

// The steps of the sky: [first column, width, row] of each cloud, over nothing.
const steps: readonly (readonly [number, number, number])[] = [
  [0, 3, 6],
  [5, 2, 5],
  [9, 2, 4],
  [13, 2, 5],
  [17, 2, 4],
  [21, 4, 5],
];

// The two secret areas, past the stage's end behind walls: the tunnel (a cave with a low ceiling, eggs along it, two cave gloomlings and
// a pipe up at the far end) and the sky (cloud steps with eggs over each, and a rainbow down at the far end). Returns their far doors.
export function secretAreas(layout: Layout): {
  readonly skyEnd: Spot;
  readonly tunnelEnd: Spot;
} {
  for (const column of [levelTiles, skyStart - 1, worldTiles - 1])
    layout.ground[column] = wallRow;
  for (let at = 0; at < secretTiles; at += 1) {
    const column = tunnelStart + at;
    layout.platform(column, 0);
    layout.platform(column, 1);
    if (at % 6 === 4) layout.platform(column, 2);
    if (at % 2 === 0 && at > 1 && at < secretTiles - 3)
      layout.egg(column, groundRow - 1 - (at % 4 === 0 ? 1 : 0));
    layout.ground[skyStart + at] = pitRow;
  }
  for (const [first, width] of [
    [5, 6],
    [15, 6],
  ] as const)
    layout.patrols.push({
      maxX: (tunnelStart + first + width) * tile,
      minX: (tunnelStart + first) * tile,
      x: (tunnelStart + first + 2) * tile,
      y: groundRow * tile - gloomHeight,
    });
  for (const [first, width, row] of steps)
    for (let at = 0; at < width; at += 1) {
      layout.platform(skyStart + first + at, row);
      layout.egg(skyStart + first + at, row - 1);
    }
  return {
    skyEnd: { x: (skyStart + secretTiles - 2) * tile, y: 3 * tile },
    tunnelEnd: {
      x: (tunnelStart + secretTiles - 2) * tile,
      y: (groundRow - 1) * tile,
    },
  };
}

// Metaplasma in the secret areas: along the tunnel, and high over the cloud steps.
export function secretMotes(): readonly Spot[] {
  const motes: Spot[] = [];
  for (let at = 1; at < secretTiles - 1; at += 1) {
    motes.push({ x: (tunnelStart + at) * tile + tile / 2, y: 4 * tile });
    motes.push({
      x: (skyStart + at) * tile + tile / 2,
      y: (2 + (at % 2)) * tile,
    });
  }
  return motes;
}
