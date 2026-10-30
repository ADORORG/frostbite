import { block } from "@ador/game-sdk/pixels";

import { targetOf, type MatchState } from "../rules/state.ts";
import { screenHeight, screenWidth, sideX } from "./layout.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

// What is written beside the board: the level and how far to the next, the swaps left, the score, the best, a line of news, and the cards
// before and after a run. All of it is on the canvas, so showing more of it never moves the page.
const font = '"Courier New", ui-monospace, monospace';
const barWidth = screenWidth - sideX - 4;

export function write(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  size = 6,
  align: CanvasTextAlign = "left",
): void {
  context.font = `bold ${String(size)}px ${font}`;
  context.textAlign = align;
  context.textBaseline = "top";
  context.fillStyle = colour.back;
  context.fillText(text, x + 0.5, y + 0.5);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

// How much of the way from the start of this level to the next the score is, in pixels of the bar.
export function progressWidth(state: MatchState, width: number): number {
  const from = state.level === 1 ? 0 : targetOf(state.level - 1);
  const span = targetOf(state.level) - from;
  return Math.min(width, Math.floor(((state.score - from) * width) / span));
}

export function side(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
): void {
  write(context, `LEVEL ${String(state.level)}`, sideX, 5, colour.text, 8);
  block(context, colour.panelLine, sideX, 16, barWidth, 3);
  block(context, colour.cursor, sideX, 16, progressWidth(state, barWidth), 3);
  write(context, "SWAPS", sideX, 24, colour.textDim, 5);
  write(
    context,
    String(state.moves),
    sideX,
    30,
    state.moves <= 3 ? colour.danger : colour.grab,
    10,
  );
  write(context, "SCORE", sideX, 44, colour.textDim, 5);
  write(context, String(state.score), sideX, 50, colour.text, 8);
  write(context, `BEST ${String(view.best)}`, sideX, 62, colour.textDim, 5);
  if (view.phase === "running" && view.toast !== null)
    write(context, view.toast, sideX, 74, colour.cursor, 6);
}

function card(
  context: CanvasRenderingContext2D,
  lines: readonly (readonly [string, string, number])[],
): void {
  context.globalAlpha = 0.84;
  block(context, colour.back, 0, 0, screenWidth, screenHeight);
  context.globalAlpha = 1;
  lines.forEach(([text, fill, size], index) => {
    write(
      context,
      text,
      screenWidth / 2,
      24 + index * 12,
      fill,
      size,
      "center",
    );
  });
}

export function cards(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
): void {
  if (view.phase === "ready")
    card(context, [
      ["SHARD MATCH", colour.grab, 10],
      ["SWAP TWO SHARDS TO MAKE A LINE OF THREE", colour.text, 5],
      ["FOUR MAKES A BOMB, FIVE A STAR", colour.cursor, 5],
      ["ARROWS + SPACE, OR TAP - ENTER TO START", colour.textDim, 5],
    ]);
  if (view.phase === "over")
    card(context, [
      [
        state.cause === "spent" ? "WHAT A RUN!" : "OUT OF SWAPS",
        colour.danger,
        8,
      ],
      [
        `LEVEL ${String(state.level)}   SCORE ${String(state.score)}`,
        colour.text,
        7,
      ],
      [
        view.newBest ? "NEW BEST!" : `BEST ${String(view.best)}`,
        colour.grab,
        6,
      ],
      ["ENTER TO PLAY AGAIN", colour.cursor, 5],
    ]);
}
