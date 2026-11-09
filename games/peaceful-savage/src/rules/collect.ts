import type { ZoneId } from "./constants.ts";
import { blocked, type Point, within } from "./geometry.ts";
import { frontDoor, hillRadius, places, walls } from "./layout.ts";

// What a curious lead gathers: tiny plasma (energy, picked up by walking through it), clues left by the ancestors (seen only in Savage
// Vision), and the house's relics, the named heirlooms of the book (each one a true fact about the person it is named after).

// Where tiny plasma may lie: points on a grid over each room's open floor, clear of every wall and piece of furniture (and of the hilltop,
// where the giant snake sleeps). The seed chooses `plasmaPerZone` of them in each room.
interface Floor {
  readonly step: number;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly zone: ZoneId;
}

const floors: readonly Floor[] = [
  {
    step: 3_000,
    x0: -24_000,
    x1: 24_000,
    z0: -26_000,
    z1: -2_000,
    zone: "meadow",
  },
  { step: 1_100, x0: -2_400, x1: 2_400, z0: 600, z1: 13_200, zone: "hall" },
  {
    step: 1_200,
    x0: -11_400,
    x1: -3_600,
    z0: 1_400,
    z1: 6_400,
    zone: "kitchen",
  },
  { step: 1_200, x0: -11_400, x1: -3_600, z0: 7_600, z1: 13_400, zone: "kids" },
  { step: 1_200, x0: 3_600, x1: 11_000, z0: 600, z1: 6_400, zone: "office" },
  {
    step: 1_200,
    x0: 3_600,
    x1: 11_000,
    z0: 7_600,
    z1: 13_400,
    zone: "parents",
  },
];

export const plasmaPerZone = 12;
export const plasmaRadius = 700;

// Every open point of each room, in a fixed order.
export const plasmaSpots: readonly (readonly Point[])[] = floors.map(
  (floor) => {
    const spots: Point[] = [];
    for (let z = floor.z0; z <= floor.z1; z += floor.step)
      for (let x = floor.x0; x <= floor.x1; x += floor.step) {
        const point = { x, z };
        const clear =
          !within(point, places.hill, hillRadius) &&
          !blocked(
            point,
            [...walls, frontDoor].map((wall) => ({
              x0: wall.x0 - 200,
              x1: wall.x1 + 200,
              z0: wall.z0 - 200,
              z1: wall.z1 + 200,
            })),
          );
        if (clear) spots.push(point);
      }
    return spots;
  },
);

export const plasmaCount = plasmaSpots.length * plasmaPerZone;

// A clue in each room, at one of two places the seed chooses.
export interface Clue {
  readonly spots: readonly [Point, Point];
  readonly zone: ZoneId;
}

export const clues: readonly Clue[] = [
  {
    spots: [
      { x: -2_000, z: 7_400 },
      { x: 1_900, z: 12_200 },
    ],
    zone: "hall",
  },
  {
    spots: [
      { x: -11_000, z: 3_400 },
      { x: -6_800, z: 6_300 },
    ],
    zone: "kitchen",
  },
  {
    spots: [
      { x: -9_000, z: 13_400 },
      { x: -4_000, z: 7_700 },
    ],
    zone: "kids",
  },
  {
    spots: [
      { x: 9_400, z: 6_200 },
      { x: 4_000, z: 4_200 },
    ],
    zone: "office",
  },
  {
    spots: [
      { x: 4_000, z: 11_800 },
      { x: 11_000, z: 7_700 },
    ],
    zone: "parents",
  },
  {
    spots: [
      { x: 15_000, z: -20_000 },
      { x: -16_000, z: -16_000 },
    ],
    zone: "meadow",
  },
];

// Where a clue lies: the first of its two places, or the second.
export const clueSpot = (clue: Clue, at: number | undefined): Point =>
  at === 1 ? clue.spots[1] : clue.spots[0];

// The relics: one in each room, where they always are.
export interface Relic extends Point {
  readonly id: string;
}

export const relics: readonly Relic[] = [
  { id: "banneker", x: -2_500, z: 2_600 },
  { id: "mccoy", x: -11_200, z: 6_200 },
  { id: "jones", x: -8_400, z: 13_500 },
  { id: "woods", x: 4_400, z: 2_000 },
  { id: "walker", x: 4_300, z: 9_300 },
  { id: "morgan", x: -7_300, z: -9_400 },
];

// The mirrors (a still pond in the meadow is one too): a breath and a look, and the lead is re-centred.
export const mirrors: readonly Relic[] = [
  { id: "hall-mirror", x: 2_700, z: 2_200 },
  { id: "kids-mirror", x: -3_300, z: 12_600 },
  { id: "office-mirror", x: 8_000, z: 6_700 },
  { id: "parents-mirror", x: 3_300, z: 8_200 },
  { id: "pond", x: -12_000, z: -14_000 },
];
