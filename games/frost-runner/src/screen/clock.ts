import { ticksPerSecond } from "../rules/constants.ts";

// The screen runs on a timer and the rules know only ticks: this turns elapsed time into whole ticks, keeping the remainder for the
// next frame. A long pause (a hidden tab) is cut short, so the runner is not run into a wall on the player's return.
const tickMs = 1000 / ticksPerSecond;
export const mostTicksAFrame = 5;

export function ticksIn(
  carried: number,
  elapsedMs: number,
): { readonly carried: number; readonly ticks: number } {
  const total = carried + Math.max(0, elapsedMs);
  const ticks = Math.min(mostTicksAFrame, Math.floor(total / tickMs));
  return {
    carried: ticks === mostTicksAFrame ? 0 : total - ticks * tickMs,
    ticks,
  };
}
