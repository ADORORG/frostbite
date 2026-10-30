import { block } from "@ador/game-sdk/pixels";

import type { RunState } from "../rules/types.ts";
import { snowball } from "./ball.ts";
import { cards, hud } from "./hud.ts";
import { canvasScale, screenHeight, screenWidth } from "./layout.ts";
import { colour } from "./palette.ts";
import { obstacles, pits } from "./obstacles.ts";
import { ground, hills, shards, sky, snowfall, speedLines } from "./world.ts";
import { levelAt, speedAt } from "../rules/course.ts";
import type { View } from "./view.ts";

export { canvasScale, screenHeight, screenWidth } from "./layout.ts";

// Draws a state: the whole screen, every time, in the same order (sky, hills, snow, the ground and what is on it, the snowball, the writing).
// It draws and decides nothing, and it makes nothing the page has to lay out again.
export function draw(
  context: CanvasRenderingContext2D,
  state: RunState,
  view: View,
): void {
  context.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  context.imageSmoothingEnabled = false;
  block(context, colour.pit, 0, 0, screenWidth, screenHeight);
  sky(context, state);
  hills(context, state);
  snowfall(context, state);
  speedLines(context, state, speedAt(levelAt(state.distance)));
  ground(context, state);
  pits(context, state);
  obstacles(context, state);
  shards(context, state);
  snowball(context, state);
  if (!state.alive) {
    context.globalAlpha = Math.max(0, 0.35 - (state.tick % 60) / 200);
    block(context, colour.danger, 0, 0, screenWidth, screenHeight);
    context.globalAlpha = 1;
  }
  hud(context, state, view);
  cards(context, state, view);
}
