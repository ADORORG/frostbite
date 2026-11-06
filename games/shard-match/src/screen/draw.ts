import { block } from "@frostbite/game-sdk/pixels";

import { cells } from "../rules/constants.ts";
import type { MatchState } from "../rules/state.ts";
import { banner, praise, side, strip } from "./hud.ts";
import {
  boardX,
  boardY,
  canvasScale,
  cell,
  cellX,
  cellY,
  sizeOf,
} from "./layout.ts";
import { colour } from "./palette.ts";
import { placeOf } from "./particles.ts";
import type { Piece, Scene } from "./scene.ts";
import { frame, shard } from "./shapes.ts";
import type { View } from "./view.ts";

export { canvasScale, screenHeight, screenWidth } from "./layout.ts";

// The pieces of the board when nothing is playing back: each shard in its cell, with the frost of the state.
const resting = (state: MatchState): readonly Piece[] =>
  Array.from({ length: cells }, (_, index) => ({
    flash: false,
    frosted: state.frost[index] === true,
    value: state.board[index] ?? 0,
    x: cellX(index),
    y: cellY(index),
  }));

// Draws the screen: the back, the board (a faint chequer under the shards), the shards where they are, the confetti, the hint, the cursor, the
// writing, the praise and the cards, in that order. `state` is what the writing says, `scene` what a swap's playback shows (the pieces
// moving), or null at rest. It draws and decides nothing, and it makes nothing the page has to lay out again.
export function draw(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
  scene: Scene | null = null,
  bonus = 0,
): void {
  context.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  context.imageSmoothingEnabled = false;
  const size = sizeOf(view.shape);
  block(context, colour.back, 0, 0, size.width, size.height);
  context.save();
  context.translate(scene?.shake ?? 0, 0);
  block(
    context,
    colour.panel,
    boardX - 2,
    boardY - 2,
    8 * cell + 4,
    8 * cell + 4,
  );
  for (let index = 0; index < cells; index += 1)
    if ((index + Math.floor(index / 8)) % 2 === 0)
      block(context, colour.panelLine, cellX(index), cellY(index), cell, cell);
  context.beginPath();
  context.rect(boardX - 2, boardY - 2, 8 * cell + 4, 8 * cell + 4);
  context.clip();
  for (const piece of scene?.pieces ?? resting(state))
    shard(context, piece.value, piece.x, piece.y, {
      flash: piece.flash,
      frosted: piece.frosted,
    });
  for (const { age, particle } of scene?.sparks ?? []) {
    const place = placeOf(particle, age);
    if (place !== null)
      block(
        context,
        particle.fill,
        place.x,
        place.y,
        age < 14 ? 2 : 1,
        age < 14 ? 2 : 1,
      );
  }
  if (view.phase === "running" && scene === null) {
    for (const index of view.hint)
      frame(context, colour.grab, cellX(index) + 1, cellY(index) + 1, cell - 2);
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
  context.restore();
  (view.shape === "tall" ? strip : side)(context, state, view, scene);
  if (scene !== null) {
    praise(context, scene);
    if (scene.banner) banner(context, state.level - 1, bonus);
  }
}
