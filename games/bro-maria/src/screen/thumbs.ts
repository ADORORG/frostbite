import { attachZones } from "@frostbite/game-sdk/touch-zones";

import type { Controls } from "../rules/types.ts";

// The touch screen is the controller, with no buttons over it. It is cut in three side by side, and a finger holds what is under it: the
// left quarter runs back, the next quarter runs forward, the right half jumps. A finger that slides from one to the next lets go of the
// first and takes the second, and a thumb can run while the other one jumps (the SDK follows the fingers).
export type Hold = (control: keyof Controls, on: boolean) => void;

// Where the zones change, as a part of the screen's width from its left edge.
export const backEdge = 0.25;
export const jumpEdge = 0.5;

export function zoneOf(fraction: number): "left" | "right" | "jump" {
  if (fraction < backEdge) return "left";
  return fraction < jumpEdge ? "right" : "jump";
}

export const attachThumbs = (screen: HTMLElement, hold: Hold): (() => void) =>
  attachZones<keyof Controls>(screen, {
    enter: (control) => hold(control, true),
    fingersOnly: true,
    leave: (control) => hold(control, false),
    slide: true,
    zoneAt: ({ x }) => zoneOf(x),
  });
