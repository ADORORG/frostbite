import type { Point } from "./geometry.ts";

// The things in the house and the meadow a hand can touch: each has a place and a kind (the view knows how a kind moves when it is
// touched: a door swings, a tap runs, a drum is hit). Touching one turns it on or off; the first touch of each is a little colour back in
// its room. The lamps are kept apart, since lighting every one of them is a goal of its own.
export interface Thing extends Point {
  readonly id: string;
}

export const things: readonly Thing[] = [
  // The kitchen.
  { id: "fridge", x: -11_500, z: 1_300 },
  { id: "tap", x: -9_600, z: 900 },
  { id: "ice", x: -10_600, z: 900 },
  { id: "juice", x: -7_200, z: 4_000 },
  { id: "toaster", x: -6_200, z: 900 },
  { id: "chair", x: -5_100, z: 4_700 },
  // The children's room.
  { id: "rocket", x: -8_800, z: 9_600 },
  { id: "projector", x: -6_800, z: 10_400 },
  { id: "drum", x: -4_200, z: 8_400 },
  { id: "toychest", x: -7_500, z: 7_900 },
  { id: "kaibed", x: -10_800, z: 8_600 },
  { id: "zorabed", x: -10_800, z: 12_400 },
  // The office.
  { id: "monitor", x: 7_400, z: 3_200 },
  { id: "globe", x: 5_600, z: 1_200 },
  { id: "books", x: 11_300, z: 3_400 },
  { id: "whiteboard", x: 3_200, z: 1_400 },
  { id: "records", x: 5_600, z: 6_400 },
  { id: "armchair", x: 5_000, z: 5_900 },
  // The parents' room.
  { id: "wardrobe", x: 11_300, z: 8_400 },
  { id: "vanity", x: 3_400, z: 12_600 },
  { id: "bigbed", x: 9_800, z: 10_000 },
  { id: "plant", x: 6_600, z: 7_500 },
  { id: "musicbox", x: 9_200, z: 7_500 },
  { id: "curtain", x: 6_800, z: 13_800 },
  // The hall.
  { id: "coats", x: -2_800, z: 800 },
  { id: "window", x: 2_700, z: 1_000 },
  { id: "couch", x: 0, z: 12_900 },
  { id: "photos", x: -2_800, z: 8_200 },
  { id: "hallplant", x: -2_500, z: 11_800 },
  { id: "clock", x: 2_700, z: 8_600 },
  // The meadow.
  { id: "trafficlight", x: -8_000, z: -9_000 },
  { id: "swing", x: 10_000, z: -7_400 },
  { id: "bench", x: -3_200, z: -4_150 },
  { id: "postbox", x: 6_000, z: -3_000 },
  { id: "bluebells", x: -14_000, z: -6_000 },
  { id: "poppies", x: 13_000, z: -13_000 },
];

// The lamps of the house, out at the start (every light in the house guttered out, one by one), and the porch lamp by the front door.
export const lamps: readonly Thing[] = [
  { id: "kitchen-lamp", x: -3_400, z: 1_600 },
  { id: "kids-lamp", x: -9_000, z: 11_000 },
  { id: "office-lamp", x: 10_200, z: 1_000 },
  { id: "parents-lamp", x: 7_600, z: 13_600 },
  { id: "hall-lamp", x: -2_600, z: 4_600 },
  { id: "hall-lamp-south", x: 2_600, z: 9_200 },
  { id: "porch-lamp", x: 1_600, z: -600 },
];

// How many things a curious hand must have touched for each of the two goals.
export const curiousAt = 12;
export const veryCuriousAt = 30;
