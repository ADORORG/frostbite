// The screen's size and the scale from the rules' units to its pixels; the drawing helpers (block, sprite, wrap) are the SDK's.
export const screenWidth = 160;
export const screenHeight = 90;
export const groundY = 72;
export const runnerX = 20;
export const scale = 0.5;

// Units of the rules' world to pixels of the screen.
export const px = (units: number): number => Math.round(units * scale);

export { block, sprite, wrap } from "@frostbite/game-sdk/pixels";
