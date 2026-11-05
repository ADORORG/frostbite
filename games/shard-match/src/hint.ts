import { neighbour } from "./rules/board.ts";
import { legalMoves } from "./rules/moves.ts";
import type { MatchState } from "./rules/state.ts";

// How long the player must have been still before the screen points at a swap worth making, in milliseconds.
export const hintAfterMs = 6_000;

// The two cells of a swap that makes a line, to point at: the one that makes the longest line first (the first found, among equals). Nothing
// here is part of the rules.
export function hintFor(state: MatchState): readonly number[] {
  const [first] = legalMoves(state.board);
  return first === undefined ? [] : [first[0], neighbour(first[0], first[1])];
}

// Every second, if `quiet` says the player may be left alone and nobody has touched anything for `hintAfterMs`, `show` is called once with the
// swap to point at; `clear` rearms it (a move, a new run).
export function watchIdle(options: {
  readonly lastInput: () => number;
  readonly quiet: () => boolean;
  readonly shown: () => boolean;
  readonly show: () => void;
}): void {
  setInterval(() => {
    if (!options.quiet() || options.shown()) return;
    if (Date.now() - options.lastInput() >= hintAfterMs) options.show();
  }, 1_000);
}
