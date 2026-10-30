import { block } from "@ador/game-sdk/pixels";

import type { PulseState } from "../rules/state.ts";
import { aurora, lanesView } from "./field.ts";
import { cards, hud } from "./hud.ts";
import { canvasScale, screenHeight, screenWidth } from "./layout.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

export { canvasScale, screenHeight, screenWidth } from "./layout.ts";

// Draws a state: the whole screen, every time, in the same order (the back, the aurora, the lanes and their notes, the writing, the cards). It
// draws and decides nothing, and it makes nothing the page has to lay out again.
export function draw(
  context: CanvasRenderingContext2D,
  state: PulseState,
  view: View,
): void {
  context.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  context.imageSmoothingEnabled = false;
  block(context, colour.back, 0, 0, screenWidth, screenHeight);
  aurora(context, state);
  lanesView(context, state);
  hud(context, state, view);
  cards(context, state, view);
}
