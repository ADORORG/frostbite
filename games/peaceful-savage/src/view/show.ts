import { Vector3 } from "three";

import type { Ride } from "./ride.ts";

// The show at the end: a stage on the lawn in front of the house, facing out over the meadow (and the camera). The family sings at the
// front, each at a microphone, the band of ancestors plays behind them, speakers stand either side and a truss of lights overhead. The
// player takes one of the family at a time and moves them about the stage. Here is where everything stands; the stage is built in
// world/stage.ts, and when it all happens is in farewell.ts.

// The stage's top, its edges (x across, z from front to back), and the steps up at its back.
export const stage = {
  back: -6.8,
  front: -9.8,
  left: 3.4,
  right: -3.4,
  top: 0.72,
} as const;

// Where each of the family sings, by their place in the line from the screen's left (Daddy, Kai, Zora, Mama), and their microphone.
export const singAt = (line: number): Vector3 =>
  new Vector3((1.5 - line) * 1.3, 0, -8.9);
export const micAt = (line: number): Vector3 =>
  singAt(line).add(new Vector3(0, 0, -0.45));

// Where the band plays: the drums in the middle at the back, the keys at the screen's left, the strings at its right.
export const band = {
  drums: new Vector3(0, 0, -7.35),
  keys: new Vector3(2.25, 0, -7.55),
  strings: new Vector3(-2.25, 0, -7.55),
} as const;

// How far the one the player moves may go: about the front of the stage, never into the band or off the edge.
export const bounds = { back: -7.9, front: -9.45, side: 3.05 } as const;

// What the page tells the view while the show plays: who the player moves, where each of the family has been moved to from where they
// sing (in metres), when the player last asked for a big move (a spin and a jump; milliseconds, as the page keeps time), and whether the
// one they move is walking.
export interface StageControl {
  readonly at: Readonly<
    Record<string, { readonly x: number; readonly z: number }>
  >;
  readonly moveAt: number;
  // After the show, where the player has driven the hover car (null while it cruises by itself).
  readonly ride?: Ride | null;
  readonly walking: boolean;
  readonly who: string;
}

// Keeps a moved place on the stage.
export function onStage(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(-bounds.side, Math.min(bounds.side, x)),
    z: Math.max(bounds.front, Math.min(bounds.back, z)),
  };
}

// How high to lift someone standing at `at` so they stand on the stage, eased as they step up its back and down again.
export function stageLift(
  at: Vector3,
  ground: (x: number, z: number) => number,
  shown: number,
): number {
  if (shown <= 0) return 0;
  const inside =
    Math.abs(at.x) <= stage.left &&
    at.z <= stage.back + 0.3 &&
    at.z >= stage.front;
  if (!inside) return 0;
  const up = Math.max(0, Math.min(1, (stage.back + 0.3 - at.z) / 0.6));
  return Math.max(0, stage.top - ground(at.x, at.z)) * up * Math.min(1, shown);
}
