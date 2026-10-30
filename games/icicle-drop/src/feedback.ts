import type { DropState } from "./rules/state.ts";

// What the player hears for a move: a join if the move joined tiles (higher for a bigger tile), a slide if it only moved them.
export type MoveSound =
  | { readonly kind: "join"; readonly biggest: number }
  | { readonly kind: "slide" };

export function moveSound(before: DropState, after: DropState): MoveSound {
  return after.merges > before.merges
    ? { biggest: Math.max(...after.board), kind: "join" }
    : { kind: "slide" };
}
