import type { MatchState } from "./rules/state.ts";

// What the screen says of the swap just made: how long the chain ran, if it ran, and what the swap scored.
export const toastFor = (state: MatchState): string =>
  state.lastDepth >= 2
    ? `CHAIN x${String(state.lastDepth)}  +${String(state.lastGain)}`
    : `+${String(state.lastGain)}`;

// How much faster the music goes as the swaps run low: up to half again as fast.
export const tempoFor = (moves: number): number =>
  moves >= 6 ? 1 : Math.min(1.5, 1 + (6 - moves) / 12);
