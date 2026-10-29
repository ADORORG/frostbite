// A screen runs on a timer and a game's rules know only ticks: this turns elapsed time into whole ticks, keeping the remainder for the
// next frame. A long pause (a hidden tab) is cut short to `mostTicksAFrame`, so a player is not run into a wall on returning.
export const mostTicksAFrame = 5;

export function ticksIn(
  carried: number,
  elapsedMs: number,
  ticksPerSecond: number,
): { readonly carried: number; readonly ticks: number } {
  const tickMs = 1000 / ticksPerSecond;
  const total = carried + Math.max(0, elapsedMs);
  const ticks = Math.min(mostTicksAFrame, Math.floor(total / tickMs));
  return {
    carried: ticks === mostTicksAFrame ? 0 : total - ticks * tickMs,
    ticks,
  };
}
