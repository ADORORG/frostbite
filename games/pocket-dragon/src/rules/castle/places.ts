import type { Spot } from "./types.ts";

// Who and what is where on the map, by tile. The four friends each want one thing; once they have it they join the guild and follow
// Glitchy, and each can then clear one kind of obstacle. The three guards and the Grumble King hold the castle's doors, in order.
export const start: Spot = { x: 8, y: 25 };

export const items: readonly Spot[] = [
  { x: 5, y: 28 },
  { x: 36, y: 27 },
  { x: 7, y: 17 },
  { x: 2, y: 12 },
];

// Bolt pushes boulders, Splash grows lily pads across the ford, Bloom asks brambles to part, Spark lights up a cheer challenge.
export const friends: readonly Spot[] = [
  { x: 22, y: 24 },
  { x: 24, y: 22 },
  { x: 21, y: 16 },
  { x: 35, y: 12 },
];
export const bolt = 0;
export const splash = 1;
export const bloom = 2;
export const spark = 3;

export const boulders: readonly Spot[] = [
  { x: 23, y: 24 },
  { x: 31, y: 25 },
];
export const brambles: readonly Spot[] = [
  { x: 19, y: 14 },
  { x: 3, y: 12 },
];
export const ice: Spot = { x: 8, y: 17 };

// The castle's keepers, from the gate in: three guards, then the Grumble King. The Legendary Golden Egg rests on the throne behind the
// king. The gate itself opens only in winter, to the three clues.
export const foes: readonly Spot[] = [
  { x: 19, y: 9 },
  { x: 19, y: 7 },
  { x: 19, y: 4 },
  { x: 19, y: 3 },
];
export const king = 3;
export const throne: Spot = { x: 19, y: 2 };
export const gate: Spot = { x: 19, y: 10 };

// The river's rows and the bramble wall's row: south of the river is home, north of the wall is the castle.
// The three secret charms, off the quest's way: spirit in the village corner, the star on the beach, the shield in the north meadow.
export const charmSpots: readonly Spot[] = [
  { x: 1, y: 22 },
  { x: 38, y: 22 },
  { x: 37, y: 18 },
];

export const riverRow = 20;
export const wallRow = 14;

// The three houses that can be entered, by the door in their wall and the room inside (`rooms.ts`): the bakery and the library in the
// village, the watchtower in the north meadow.
export const doors: readonly Spot[] = [
  { x: 3, y: 24 },
  { x: 3, y: 27 },
  { x: 37, y: 12 },
];

// The night: the eggs the security guards are after, where the guards come from, and the cage cart they carry eggs to (next to the
// castle). A forcefield bubble lies in the village.
export const nightEggs: readonly Spot[] = [
  { x: 6, y: 22 },
  { x: 14, y: 26 },
  { x: 27, y: 27 },
  { x: 12, y: 18 },
  { x: 30, y: 17 },
  { x: 25, y: 16 },
  { x: 8, y: 13 },
  { x: 30, y: 12 },
];
export const guardStarts: readonly Spot[] = [
  { x: 17, y: 12 },
  { x: 22, y: 13 },
  { x: 24, y: 11 },
];
export const cage: Spot = { x: 21, y: 12 };
export const bubble: Spot = { x: 16, y: 25 };
