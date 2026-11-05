import { isTouchScreen } from "@frostbite/game-sdk/touch";

import type { State } from "../rules/types.ts";
import { write } from "./banner.ts";
import { colour } from "./palette.ts";
import { backEdge, jumpEdge } from "./thumbs.ts";

// For the first moments of a run on a touch screen the three zones are named at the foot of the screen, so a player sees where to put a
// thumb without reading anything. It only draws; nothing reads it.
export const hintTicks = 300;
const hintSize = 8;
// How faint the names are, so the game shows through them.
export const hintAlpha = 0.6;
export const hintBottom = 14;

export function touchHints(
  context: CanvasRenderingContext2D,
  state: State,
  width: number,
  height: number,
  touch: boolean = isTouchScreen(),
): void {
  if (!touch || state.tick >= hintTicks) return;
  const zones = [
    ["< BACK", 0, backEdge],
    ["FORWARD >", backEdge, jumpEdge],
    ["JUMP", jumpEdge, 1],
  ] as const;
  context.save();
  context.globalAlpha = hintAlpha;
  for (const [text, from, to] of zones)
    write(
      context,
      text,
      ((from + to) / 2) * width,
      height - hintBottom,
      hintSize,
      colour.white,
    );
  context.restore();
}
