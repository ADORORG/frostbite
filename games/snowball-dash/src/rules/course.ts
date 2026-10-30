import { baseSpeed, levelLength, topSpeed } from "./constants.ts";

// How far the snowball has come sets its level, and its level sets how fast it rolls: faster by one a tick each level, up to the top speed.
export const levelAt = (distance: number): number =>
  Math.floor(distance / levelLength);

export const speedAt = (level: number): number =>
  Math.min(topSpeed, baseSpeed + level);
