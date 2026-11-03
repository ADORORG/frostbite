import { kindsAt, type MatchState } from "../rules/state.ts";
import { neighbour } from "../rules/board.ts";
import { swapped } from "../rules/moves.ts";
import { resolve, type Resolved } from "../rules/resolve.ts";

// What the swap of `cell` and its neighbour in `direction` sets going, step by step, played again from the state before it (the rules are
// pure, so this gives the very steps the swap had) for the screen to play back. The swap is one the rules have already accepted.
export function traceOf(
  before: MatchState,
  cell: number,
  direction: number,
): Resolved {
  const other = neighbour(cell, direction);
  return resolve(
    swapped(before.board, cell, other),
    [cell, other],
    kindsAt(before.level),
    before.rng,
  );
}
