import { bringIn } from "./lock.ts";
import type { PermafrostState } from "./types.ts";

// Puts the piece away and brings out the one held (or the next, the first time). Once per piece.
export function holdPiece(state: PermafrostState): PermafrostState {
  if (state.holdUsed) return state;
  const kind = state.piece.kind;
  const swapped = bringIn(state, state.hold === 0 ? null : state.hold);
  return {
    ...swapped,
    hold: kind,
    holdUsed: true,
    holds: state.holds + 1,
  };
}
