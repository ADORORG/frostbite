import { block, sprite, wrap } from "@frostbite/game-sdk/pixels";

// The screen's size and where the tower stands on it. The field is the rules' width in units, one to a pixel, in the middle of the screen.
export const screenWidth = 160;
export const screenHeight = 90;
export const fieldLeft = 20;
export const groundY = 80;
export const slabHeight = 6;
// How many blocks are in view above the foot of the screen before the view starts to rise with the tower.
export const rowsInView = 7;

export { block, sprite, wrap };

// Where the top edge of block `row` (0 is the first one) is, with the view risen by `camera` pixels.
export const rowTop = (row: number, camera: number): number =>
  groundY - (row + 1) * slabHeight + camera;
