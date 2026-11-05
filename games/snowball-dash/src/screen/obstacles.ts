import { block, sprite } from "@frostbite/game-sdk/pixels";

import { sizes } from "../rules/constants.ts";
import type { Obstacle, RunState } from "../rules/types.ts";
import { colour } from "./palette.ts";
import { groundY, px, screenHeight, screenWidth, screenX } from "./layout.ts";

// What lies on the slope: rocks, boulders, rows of ice spikes, and crevasses in the snow. Each is drawn at the place the rules put it and
// is exactly as wide and high as the rules say, so what the player sees is what the snowball meets.
const rockPicture = [
  "..oooooo..",
  ".ollllbbo.",
  "olllbbbbbo",
  "olbbbbbbdo",
  "obbbbbbddo",
  "obbbbbdddo",
  "oobbdddddo",
  ".oooooooo.",
];
const key = {
  b: colour.rock,
  d: colour.rockDark,
  l: colour.rockLight,
  o: colour.outline,
};

function boulder(context: CanvasRenderingContext2D, left: number): void {
  const width = px(sizes.boulder.w);
  const height = px(sizes.boulder.h);
  for (let row = 0; row < height; row += 1) {
    const edge = Math.min(row, height - 1 - row);
    const inset = edge < 4 ? 4 - edge : 0;
    const rowLeft = left + inset;
    const rowWidth = width - inset * 2;
    block(
      context,
      colour.outline,
      rowLeft,
      groundY - height + row,
      rowWidth,
      1,
    );
    block(
      context,
      colour.rock,
      rowLeft + 1,
      groundY - height + row,
      rowWidth - 2,
      1,
    );
    block(
      context,
      colour.rockDark,
      rowLeft + Math.floor(rowWidth * 0.6),
      groundY - height + row,
      rowWidth - Math.floor(rowWidth * 0.6) - 1,
      1,
    );
  }
  block(
    context,
    colour.rockLight,
    left + 5,
    groundY - height + 4,
    3,
    height / 2,
  );
  block(context, colour.rockLight, left + 5, groundY - height + 3, 6, 1);
  block(context, colour.outline, left + width - 7, groundY - height + 9, 1, 6);
  block(context, colour.outline, left + width - 6, groundY - height + 14, 3, 1);
}

function spikes(context: CanvasRenderingContext2D, left: number): void {
  const width = px(sizes.spikes.w);
  const height = px(sizes.spikes.h);
  for (let at = 0; at + 6 <= width; at += 6)
    for (let row = 0; row < height; row += 1) {
      const inset = Math.floor((row * 3) / height);
      const rowWidth = 6 - inset * 2;
      block(
        context,
        colour.outline,
        left + at + inset,
        groundY - 1 - row,
        rowWidth,
        1,
      );
      if (rowWidth > 2)
        block(
          context,
          row < 2 ? colour.ice : colour.snow,
          left + at + inset + 1,
          groundY - 1 - row,
          rowWidth - 2,
          1,
        );
    }
}

function pit(
  context: CanvasRenderingContext2D,
  obstacle: Obstacle,
  distance: number,
): void {
  const left = screenX(obstacle.x, distance);
  const width = px(obstacle.w);
  block(context, colour.pit, left, groundY, width, screenHeight - groundY);
  block(context, colour.snow, left - 1, groundY, 1, 3);
  block(context, colour.snow, left + width, groundY, 1, 3);
  for (let at = 4; at < width - 3; at += 7)
    block(context, colour.ice, left + at, groundY, 2, 2 + ((at / 7) % 3));
  block(context, colour.pitGlow, left, screenHeight - 3, width, 1);
}

export function pits(context: CanvasRenderingContext2D, state: RunState): void {
  for (const obstacle of state.ahead)
    if (obstacle.kind === "pit") pit(context, obstacle, state.distance);
}

export function obstacles(
  context: CanvasRenderingContext2D,
  state: RunState,
): void {
  for (const obstacle of state.ahead) {
    const left = screenX(obstacle.x, state.distance);
    if (left > screenWidth || left + px(obstacle.w) < 0) continue;
    if (obstacle.kind === "rock")
      sprite(context, rockPicture, key, left, groundY - 8);
    else if (obstacle.kind === "boulder") boulder(context, left);
    else if (obstacle.kind === "spikes") spikes(context, left);
  }
}
