import { maxMultiplier, levelLength } from "../rules/constants.ts";
import type { RunState } from "../rules/types.ts";
import { block } from "@ador/game-sdk/pixels";

import { colour } from "./palette.ts";
import { screenHeight, screenWidth } from "./layout.ts";
import type { View } from "./view.ts";

// What is written over the screen: the score and the multiplier, the best, how far through the level the snowball is, a line of news, and
// the cards before and after a run. All of it is on the canvas, so showing more of it never moves the page.
const font = '"Courier New", ui-monospace, monospace';

function write(
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
  context.fillStyle = colour.pit;
  context.fillText(text, x + 0.5, y + 0.5);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

export const multiplierOf = (streak: number): number =>
  Math.min(maxMultiplier, 1 + streak);

export function hud(
  context: CanvasRenderingContext2D,
  state: RunState,
  view: View,
): void {
  const progress = (state.distance % levelLength) / levelLength;
  block(context, colour.hill, 0, 0, screenWidth, 2);
  block(context, colour.cyan, 0, 0, Math.round(screenWidth * progress), 2);
  write(context, String(state.score), 4, 4, colour.text, 8);
  const multiplier = multiplierOf(state.streak);
  if (multiplier > 1)
    write(context, `x${String(multiplier)}`, 4, 14, colour.yellow, 8);
  write(
    context,
    `BEST ${String(view.best)}`,
    screenWidth - 4,
    4,
    colour.snowDark,
    6,
    "right",
  );
  if (
    view.phase === "running" &&
    view.toast !== null &&
    state.tick < view.toast.until
  )
    write(
      context,
      view.toast.text,
      screenWidth / 2,
      22,
      colour.yellow,
      7,
      "center",
    );
}

function card(
  context: CanvasRenderingContext2D,
  lines: readonly (readonly [string, string, number])[],
): void {
  context.globalAlpha = 0.6;
  block(context, colour.pit, 0, 0, screenWidth, screenHeight);
  context.globalAlpha = 1;
  lines.forEach(([text, fill, size], index) =>
    write(
      context,
      text,
      screenWidth / 2,
      18 + index * 12,
      fill,
      size,
      "center",
    ),
  );
}

export function cards(
  context: CanvasRenderingContext2D,
  state: RunState,
  view: View,
): void {
  if (view.phase === "ready")
    card(context, [
      ["SNOWBALL DASH", colour.cyan, 10],
      ["TAP, HOLD FOR HIGHER", colour.text, 6],
      ["CLOSE CALLS BUILD YOUR SCORE", colour.snowDark, 6],
      ["ENTER, SPACE OR TAP TO ROLL", colour.yellow, 6],
    ]);
  else if (view.phase === "over")
    card(context, [
      [
        state.cause === "fell" ? "INTO THE CREVASSE" : "RUN OVER",
        colour.danger,
        10,
      ],
      [`SCORE ${String(state.score)}`, colour.text, 8],
      [
        view.newBest ? "NEW BEST!" : `BEST ${String(view.best)}`,
        colour.yellow,
        7,
      ],
      ["ENTER, SPACE OR TAP TO ROLL AGAIN", colour.snowDark, 6],
    ]);
}
