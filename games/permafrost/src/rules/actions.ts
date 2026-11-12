import { holdPiece } from "./hold.ts";
import { hardDrop } from "./lock.ts";
import { dropped, shifted, turned } from "./motion.ts";
import type { Action, PermafrostState } from "./types.ts";

// What a key does at the moment it is pressed. A key that can do nothing (a move into a wall, a second hold) is allowed and changes
// nothing, so a player's hands are never at odds with the rules.
export function act(state: PermafrostState, action: Action): PermafrostState {
  if (state.blocked) return state;
  const { board, piece } = state;
  switch (action) {
    case "left":
      return { ...state, piece: shifted(board, piece, -1) };
    case "right":
      return { ...state, piece: shifted(board, piece, 1) };
    case "turnRight":
      return { ...state, piece: turned(board, piece, 1) };
    case "turnLeft":
      return { ...state, piece: turned(board, piece, -1) };
    case "softOn":
      return { ...state, softDrop: true };
    case "softOff":
      return { ...state, softDrop: false };
    case "hold":
      return holdPiece(state);
    case "hard": {
      const down = dropped(board, piece);
      return hardDrop(state, down.piece, down.rows);
    }
  }
}
