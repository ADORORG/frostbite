import { Vector3 } from "three";

import { ways } from "../rules/ways.ts";

// The rules measure in whole millimetres with x to the east, y to the south and z up; the scene is in metres with y up. South is toward
// the camera (+z in the scene), so a direction on the screen is the same direction in the rules.
export const toScene = (x: number, y: number, z: number): Vector3 =>
  new Vector3(x / 1000, z / 1000, y / 1000);

export const setScene = (
  out: Vector3,
  x: number,
  y: number,
  z: number,
): Vector3 => out.set(x / 1000, z / 1000, y / 1000);

// The turn about the up axis that faces one of the sixteen ways (the heroes are modelled facing south).
export const headingOfWay = (way: number): number => {
  const [dx, dy] = ways[way] ?? [0, 1000];
  return Math.atan2(dx, dy);
};

export const mix = (from: number, to: number, share: number): number =>
  from + (to - from) * share;
