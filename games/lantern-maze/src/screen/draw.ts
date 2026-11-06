import { block } from "@frostbite/game-sdk/pixels";

import type { MazeState } from "../rules/state.ts";
import { hud } from "./hud.ts";
import { canvasScale, screenHeight, screenWidth } from "./layout.ts";
import { lantern, mazeView } from "./maze-view.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

export { canvasScale, screenHeight, screenWidth } from "./layout.ts";

// Draws a state: the whole screen, every time, in the same order (black, the cellar, the lantern, the writing). It draws and decides
// nothing, and it makes nothing the page has to lay out again.
export function draw(
  context: CanvasRenderingContext2D,
  state: MazeState,
  view: View,
): void {
  context.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  context.imageSmoothingEnabled = false;
  block(context, colour.black, 0, 0, screenWidth, screenHeight);
  mazeView(context, state);
  lantern(context, state);
  hud(context, state, view);
}
