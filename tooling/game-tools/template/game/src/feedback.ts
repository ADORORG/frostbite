import type { StarterState } from "./rules/types.ts";

// What the player hears for a tap: a low thud for a miss, a chime for a catch.
export type TapSound = "catch" | "miss";

export const tapSound = (
  before: StarterState,
  after: StarterState,
): TapSound => (after.ended && !before.ended ? "miss" : "catch");

// The music runs faster as the marker does, by a tenth for each unit of speed above the start, up to one and a fifth times as fast.
export const tempoScale = (speed: number): number =>
  Math.min(1.2, 1 + (speed - 1) / 10);
