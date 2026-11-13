import { levelOf } from "./rules/difficulty.ts";
import type { PermafrostState } from "./rules/types.ts";

// What the player hears for what just happened, worked out from the run before and after: the stack reaching the top, rows cleared (more for
// four, most for an empty board), a new level, a piece set down.
export type Sound = "clear" | "four" | "level" | "lock" | "over" | "perfect";

export function soundsFor(
  before: PermafrostState,
  after: PermafrostState,
): readonly Sound[] {
  if (after.blocked && !before.blocked) return ["over"];
  const sounds: Sound[] = [];
  if (after.lines > before.lines) {
    if (after.perfectClears > before.perfectClears) sounds.push("perfect");
    else sounds.push(after.fours > before.fours ? "four" : "clear");
    if (levelOf(after.lines) > levelOf(before.lines)) sounds.push("level");
  } else if (after.pieces > before.pieces) sounds.push("lock");
  return sounds;
}

// The music runs faster as the level rises, by a fortieth for each, up to a third as fast again.
export const tempoScale = (level: number): number =>
  Math.min(4 / 3, 1 + (level - 1) / 40);
