import type { Spot } from "../grid.ts";
import type { KitSpot } from "../kit.ts";

// Out of the maze, the woods are seen from above: DeFu's outpost in the trees (south), her dungeon (a dark hall) and, past it, the hall
// of her castle with the egg rocket (north). T tree, . grass, , path, ~ water, W stone wall, f the castle's floor, d the dungeon's
// floor, t a torch on the wall, G the lair's gate (shut until the three rocket keys are found), X a chest, C a cage with a dragon in it,
// B the forcefield bubble, H a heart, F the egg factory, v a valve on it, R the rocket, n a panel on it, P DeFu's platform, p a pillar.
export const baseRows: readonly string[] = [
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "WfffffffffffPPPPfffffffffffW",
  "WffpffffffffPPPPffffffffpffW",
  "WffffffffffffffffffffffffffW",
  "WffvFFFvfffffffffffffffffffW",
  "WfffFFFfffffnRRnfffffffffffW",
  "WffffvfffffffRRffffffpfffffW",
  "WffffffffffffnfffffffffffffW",
  "WfffffpffffffffffffpfffffffW",
  "WffffffffffffffffffffffffffW",
  "WWWWWWWWWWWWWfWWWWWWWWWWWWWW",
  "WddddddddddddddddddddddddddW",
  "WtddddddtddddddddddtddddddtW",
  "WWWWWWWWWWWWWGWWWWWWWWWWWWWW",
  "TTTTTTTTTTTTT,TTTTTTTTTTTTTT",
  "T....X...T...,...T......C..T",
  "T.TT.....T...,.......TT....T",
  "T....C.......,,,,,,........T",
  "T..T....TT........,...T.X..T",
  "T......B.....~~~..,........T",
  "T.TTT.......~~~~..,...TT...T",
  "T......X.....~~...,........T",
  "T..T........C.....,..TT....T",
  "T....TT...........,........T",
  "T.........H.......,...T....T",
  "T....TT.....,,,,,,,.....T..T",
  "T...........,..............T",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
];

export const baseWidth = 28;
export const baseHeight = baseRows.length;
export const baseTile = (x: number, y: number): string =>
  baseRows[y]?.[x] ?? "T";

const all = (tile: string): readonly Spot[] =>
  baseRows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === tile ? [{ x, y }] : [])),
  );

// Glitchy comes out of the maze here, at the bottom of the woods.
export const arrival: Spot = { x: 12, y: 26 };
export const cages = all("C");
export const chests = all("X");
export const valves = all("v");
export const panels = all("n");
export const bubbleSpot = all("B")[0] ?? arrival;
export const heartSpot = all("H")[0] ?? arrival;
export const lairGate = all("G")[0] ?? arrival;
// The castle's hall and the dungeon are the rows above the gate; DeFu stands on her platform, her shockwaves spread from it, and her
// shadow dragons come out of the factory's door.
export const lairRow = lairGate.y;
export const hallRows = 9;
export const defu: Spot = { x: 13, y: 2 };
export const hatchery: Spot = { x: 5, y: 7 };

// Each guard of the woods walks to and fro between its two ends.
export const guardRoutes: readonly (readonly [Spot, Spot])[] = [
  [
    { x: 2, y: 15 },
    { x: 8, y: 15 },
  ],
  [
    { x: 16, y: 17 },
    { x: 26, y: 17 },
  ],
  [
    { x: 2, y: 23 },
    { x: 10, y: 23 },
  ],
  [
    { x: 19, y: 21 },
    { x: 26, y: 21 },
  ],
];

// The backpack's foods out of the maze: a berry near where Glitchy comes out, a pineapple by the heart, a mushroom by the far cage, and
// one more mushroom in a corner of the dungeon, for the valves.
export const baseKit: readonly KitSpot[] = [
  { item: "berry", x: 4, y: 26 },
  { item: "pineapple", x: 26, y: 24 },
  { item: "mushroom", x: 26, y: 15 },
  { item: "mushroom", x: 26, y: 11 },
];
