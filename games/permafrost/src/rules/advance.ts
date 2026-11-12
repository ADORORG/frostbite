import { fits, resting } from "./board.ts";
import { softDropPoints, softDropTicksPerRow } from "./constants.ts";
import { gravityFor, levelOf, lockDelayFor } from "./difficulty.ts";
import { lock } from "./lock.ts";
import type { PermafrostState } from "./types.ts";

// One tick of falling: the piece sinks a row when its time comes (sooner while the soft drop is held), and sets once it has rested on the
// stack for the level's lock delay.
function stepTick(state: PermafrostState): PermafrostState {
  const level = levelOf(state.lines);
  let piece = state.piece;
  let score = state.score;
  if (!resting(state.board, piece)) {
    const wait = state.softDrop
      ? Math.min(gravityFor(level), softDropTicksPerRow)
      : gravityFor(level);
    const fall = piece.fall + 1;
    if (fall >= wait) {
      piece = { ...piece, fall: 0, grounded: 0, resets: 0, y: piece.y + 1 };
      if (state.softDrop) score += softDropPoints;
    } else piece = { ...piece, fall };
  }
  if (resting(state.board, piece)) {
    piece = { ...piece, grounded: piece.grounded + 1 };
    if (piece.grounded >= lockDelayFor(level))
      return lock({ ...state, piece, score, tick: state.tick + 1 });
  }
  return { ...state, piece, score, tick: state.tick + 1 };
}

// The run as it stands at `tick`: each tick between is played out, unless the stack has reached the top, when nothing moves.
export function advance(state: PermafrostState, tick: number): PermafrostState {
  let now = state;
  while (now.tick < tick) {
    now = now.blocked ? { ...now, tick } : stepTick(now);
  }
  return now;
}

export const canFall = (state: PermafrostState): boolean =>
  fits(state.board, { ...state.piece, y: state.piece.y + 1 });
