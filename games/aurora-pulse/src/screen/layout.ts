import { lanes } from "../rules/constants.ts";

// The screen is drawn small, on a grid of whole pixels, and scaled up by `canvasScale`. The lanes are in the middle, each `laneWidth` wide,
// with the hit line `hitY` pixels down; a note is `lookahead` ticks from the line when it comes in at `topY`.
export const screenWidth = 160;
export const screenHeight = 90;
export const canvasScale = 4;
export const laneWidth = 18;
export const fieldX = (screenWidth - lanes * laneWidth) / 2;
export const topY = 6;
export const hitY = 72;

export const laneX = (lane: number): number => fieldX + lane * laneWidth;

// How far down the screen a note due in `ahead` ticks is (negative once it is past the line).
export const noteY = (ahead: number, lookahead: number): number =>
  hitY - Math.round((ahead * (hitY - topY)) / lookahead);

// The lane under a point of the screen: the page is cut in four, side by side, so a thumb has room (a lane is a quarter of the width).
export const laneAt = (x: number): number =>
  Math.max(0, Math.min(lanes - 1, Math.floor((x * lanes) / screenWidth)));
