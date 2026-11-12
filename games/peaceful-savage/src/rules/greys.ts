import type { ZoneId } from "./constants.ts";
import { headingCount, headings, type Point } from "./geometry.ts";

// The grey ones: small sly snakes, each an ancestor with a feeling nobody let them have, lurking one to a room. Each holds a maridium
// thread. They are only seen in Savage Vision; once seen they stay seen. Each starts at one of three places in its room (the seed
// chooses), and a grey one that tricks the lead slips away to the next. Each circles its place slowly, half a metre out.
export interface GreyHome {
  readonly spots: readonly [Point, Point, Point];
  readonly zone: ZoneId;
}

export const greyHomes: readonly GreyHome[] = [
  {
    spots: [
      { x: -1_800, z: 8_800 },
      { x: 1_800, z: 3_600 },
      { x: -1_800, z: 11_200 },
    ],
    zone: "hall",
  },
  {
    spots: [
      { x: -10_200, z: 5_400 },
      { x: -4_400, z: 2_200 },
      { x: -8_200, z: 6_000 },
    ],
    zone: "kitchen",
  },
  {
    spots: [
      { x: -6_000, z: 8_600 },
      { x: -10_600, z: 10_400 },
      { x: -4_600, z: 10_800 },
    ],
    zone: "kids",
  },
  {
    spots: [
      { x: 5_400, z: 3_200 },
      { x: 10_400, z: 5_400 },
      { x: 6_200, z: 1_000 },
    ],
    zone: "office",
  },
  {
    spots: [
      { x: 6_400, z: 9_000 },
      { x: 10_200, z: 9_000 },
      { x: 7_200, z: 11_600 },
    ],
    zone: "parents",
  },
  {
    spots: [
      { x: -6_000, z: -14_000 },
      { x: 8_000, z: -12_000 },
      { x: -2_000, z: -8_000 },
    ],
    zone: "meadow",
  },
];

export const greyCount = greyHomes.length;
// How far a grey one circles from its place, and how many ticks it takes over each sixteenth of the circle.
export const patrolRadius = 500;
export const patrolStepTicks = 45;

// Where a grey one is on a tick: its place, and a step round its circle that the tick and its own phase decide.
export function greyAt(
  home: GreyHome,
  spot: number,
  phase: number,
  tick: number,
): Point {
  const centre = home.spots[spot % 3] ?? home.spots[0];
  const step = Math.floor((tick + phase) / patrolStepTicks) % headingCount;
  const [hx, hz] = headings[step] ?? [0, 0];
  return {
    x: centre.x + Math.trunc((hx * patrolRadius) / 1000),
    z: centre.z + Math.trunc((hz * patrolRadius) / 1000),
  };
}
