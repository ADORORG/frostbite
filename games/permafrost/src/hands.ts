// A held arrow key: pressed once it moves a column, then after a short wait it repeats until it is let go. The wait and the rate are counted
// in ticks, so the session that follows them writes down each repeat as a key of its own and a replay needs no notion of "held".
export type Direction = "left" | "right";

export const repeatDelay = 10;
export const repeatEvery = 2;

export interface Hands {
  readonly direction: Direction | null;
  // The tick the next repeat is due on.
  readonly nextAt: number;
}

export const idle: Hands = { direction: null, nextAt: 0 };

// Pressing one arrow lets go of the other: the last one pressed is the one that moves.
export const pressed = (direction: Direction, tick: number): Hands => ({
  direction,
  nextAt: tick + repeatDelay,
});

export const released = (hands: Hands, direction: Direction): Hands =>
  hands.direction === direction ? idle : hands;

// Whether a repeat is due on this tick, and the hands after it.
export function repeated(
  hands: Hands,
  tick: number,
): { readonly fire: Direction | null; readonly hands: Hands } {
  if (hands.direction === null || tick < hands.nextAt)
    return { fire: null, hands };
  return {
    fire: hands.direction,
    hands: { ...hands, nextAt: tick + repeatEvery },
  };
}
