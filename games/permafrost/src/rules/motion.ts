import { fits, resting } from "./board.ts";
import { maxLockResets } from "./constants.ts";
import { kicksFor } from "./pieces.ts";
import type { ActivePiece } from "./types.ts";

// A move or a turn that put the piece somewhere new: if it still rests on the stack the moment to set it is put off, but only so many
// times, so a piece cannot be slid about for ever.
export function afterMove(
  board: readonly number[],
  before: ActivePiece,
  moved: ActivePiece,
): ActivePiece {
  if (!resting(board, moved)) return { ...moved, grounded: 0 };
  if (!resting(board, before) || moved.resets >= maxLockResets) return moved;
  return { ...moved, grounded: 0, resets: moved.resets + 1 };
}

// The piece one column over, or as it was when that is blocked.
export function shifted(
  board: readonly number[],
  piece: ActivePiece,
  by: -1 | 1,
): ActivePiece {
  const moved = { ...piece, x: piece.x + by };
  return fits(board, moved) ? afterMove(board, piece, moved) : piece;
}

// The piece turned a quarter, kicked aside if it must be; or as it was when no kick fits.
export function turned(
  board: readonly number[],
  piece: ActivePiece,
  by: -1 | 1,
): ActivePiece {
  const rotation = (piece.rotation + by + 4) & 3;
  for (const [dx, dy] of kicksFor(piece.kind)) {
    const moved = { ...piece, rotation, x: piece.x + dx, y: piece.y + dy };
    if (fits(board, moved)) return afterMove(board, piece, moved);
  }
  return piece;
}

// How many rows the piece can drop, and the piece there.
export function dropped(
  board: readonly number[],
  piece: ActivePiece,
): { readonly piece: ActivePiece; readonly rows: number } {
  let low = piece;
  while (fits(board, { ...low, y: low.y + 1 })) low = { ...low, y: low.y + 1 };
  return { piece: low, rows: low.y - piece.y };
}
