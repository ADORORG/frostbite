import { block } from "@frostbite/game-sdk/pixels";

import { lastFloor } from "../rules/constants.ts";
import type { MazeState } from "../rules/state.ts";
import { colour } from "./palette.ts";
import { barHeight, screenWidth } from "./layout.ts";
import type { View } from "./view.ts";

// What is written over the screen: the floor, the oil, the key, the score, and a line of news. All of it is
// on the canvas, so showing more of it never moves the page.
const font = '"Courier New", ui-monospace, monospace';

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
  context.fillStyle = colour.black;
  context.fillText(text, x + 0.5, y + 0.5);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

// The oil meter is this many pixels wide and full at this much oil; more oil than that fills it and the number says the rest.
export const meterWidth = 56;
export const meterFull = 200;

export function hud(
  context: CanvasRenderingContext2D,
  state: MazeState,
  view: View,
): void {
  block(context, colour.black, 0, 0, screenWidth, barHeight);
  write(
    context,
    `FLOOR ${String(state.floor)}/${String(lastFloor)}`,
    3,
    3,
    colour.text,
  );
  const fill = Math.min(
    meterWidth,
    Math.ceil((state.oil * meterWidth) / meterFull),
  );
  block(context, colour.floorSeen, 56, 3, meterWidth, 6);
  block(
    context,
    state.oil <= 12 ? colour.danger : colour.flask,
    56,
    3,
    fill,
    6,
  );
  write(context, `OIL ${String(state.oil)}`, 60, 3, colour.text, 5);
  write(
    context,
    state.hasKey ? "KEY!" : "NO KEY",
    116,
    3,
    state.hasKey ? colour.key : colour.wallSeen,
  );
  write(
    context,
    String(state.score),
    screenWidth - 3,
    3,
    colour.flameHot,
    6,
    "right",
  );
  if (
    view.phase === "running" &&
    view.toast !== null &&
    state.moves < view.toast.until
  )
    write(
      context,
      view.toast.text,
      screenWidth / 2,
      barHeight + 1,
      colour.cyan,
      6,
      "center",
    );
}
