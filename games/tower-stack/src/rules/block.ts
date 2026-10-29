import {
  fieldWidth,
  speedStepLevels,
  startSpeed,
  topSpeed,
} from "./constants.ts";
import type { TowerState } from "./types.ts";

// How far along its sweep a block is: it goes from one end of its range to the other and back, so the position is a triangle wave of the
// distance travelled. A block with no room to move (a range of nothing) stays where it is.
export function sweepPosition(
  phase: number,
  speed: number,
  elapsed: number,
  range: number,
): number {
  if (range <= 0) return 0;
  const period = range * 2;
  const along = (phase + speed * elapsed) % period;
  return along <= range ? along : period - along;
}

// Units a tick the moving block slides, for a tower of `height` blocks.
export const speedFor = (height: number): number =>
  Math.min(topSpeed, startSpeed + Math.floor(height / speedStepLevels));

// The range the moving block's left edge can take, which depends on its width.
export const rangeOf = (width: number): number => fieldWidth - width;

// The left edge of the block that is moving, on `tick`.
export function blockX(state: TowerState, tick: number): number {
  return sweepPosition(
    state.phase,
    speedFor(state.height),
    tick - state.startTick,
    rangeOf(state.width),
  );
}
