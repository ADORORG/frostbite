import { rowsInView, slabHeight } from "./layout.ts";

// How far the view has to rise, in pixels, for a tower of `blocks` blocks: nothing until the tower is `rowsInView` high, then a block's
// height for each block more.
export const cameraTarget = (blocks: number): number =>
  Math.max(0, blocks - rowsInView) * slabHeight;

// The view rises toward its target a little each frame, quickly when it is far behind and never overshooting, so the tower climbs rather
// than jumps.
export function easeCamera(shown: number, target: number): number {
  if (shown >= target) return target;
  return Math.min(target, shown + Math.ceil((target - shown) / 5));
}
