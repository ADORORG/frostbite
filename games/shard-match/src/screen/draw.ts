import { block } from "@ador/game-sdk/pixels";

import { cells } from "../rules/constants.ts";
import type { MatchState } from "../rules/state.ts";
import { cards, side } from "./hud.ts";
import {
  boardX,
  boardY,
  canvasScale,
  cell,
  cellX,
  cellY,
  screenHeight,
  screenWidth,
} from "./layout.ts";
import { colour } from "./palette.ts";
import { frame, shard } from "./shapes.ts";
import type { View } from "./view.ts";

export { canvasScale, screenHeight, screenWidth } from "./layout.ts";

// Draws a state: the whole screen, every time, in the same order (the back, the board, what is flashing, the cursor, the writing, the cards).
// It draws and decides nothing, and it makes nothing the page has to lay out again.
export function draw(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
): void {
  context.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  context.imageSmoothingEnabled = false;
  block(context, colour.back, 0, 0, screenWidth, screenHeight);
  block(
    context,
    colour.panel,
    boardX - 2,
    boardY - 2,
    8 * cell + 4,
    8 * cell + 4,
  );
  for (let index = 0; index < cells; index += 1)
    shard(context, state.board[index] ?? 0, cellX(index), cellY(index));
  context.globalAlpha = 0.55;
  for (const index of view.flash)
    block(context, colour.white, cellX(index), cellY(index), cell, cell);
  context.globalAlpha = 1;
  if (view.phase === "running") {
    if (view.cursor >= 0)
      frame(
        context,
        colour.cursor,
        cellX(view.cursor),
        cellY(view.cursor),
        cell,
      );
    if (view.grab >= 0)
      frame(context, colour.grab, cellX(view.grab), cellY(view.grab), cell);
  }
  side(context, state, view);
  cards(context, state, view);
}
