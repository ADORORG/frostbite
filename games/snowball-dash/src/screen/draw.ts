import { block, wrap } from "@ador/game-sdk/pixels";

import {
  ballWidth,
  courseUnits,
  rockHeight,
  rockWidth,
} from "../rules/constants.ts";
import { heightAt } from "../rules/tick.ts";
import type { SnowballState } from "../rules/types.ts";
import { colour } from "./palette.ts";

// The screen is drawn small and scaled up by the page. One pixel is two units of the rules' world; the snowball stays at `ballX` and
// the world scrolls past it. It draws a state and decides nothing.
export const screenWidth = 160;
export const screenHeight = 90;
const groundY = 72;
const ballX = 24;
const unitsPerPixel = 2;
const px = (units: number): number => Math.round(units / unitsPerPixel);

const stars = [
  [12, 8],
  [40, 20],
  [66, 6],
  [91, 16],
  [118, 9],
  [143, 22],
  [30, 30],
  [105, 32],
] as const;

function backdrop(
  context: CanvasRenderingContext2D,
  state: SnowballState,
): void {
  block(context, colour.sky, 0, 0, screenWidth, groundY);
  for (const [x, y] of stars)
    block(
      context,
      colour.star,
      wrap(x - px(state.distance) / 8, screenWidth),
      y,
      1,
      1,
    );
  for (let at = 0; at < screenWidth; at += 40)
    block(
      context,
      colour.hill,
      wrap(at - px(state.distance) / 3, screenWidth),
      groundY - 10,
      24,
      10,
    );
  block(context, colour.snow, 0, groundY, screenWidth, screenHeight - groundY);
  for (let at = 0; at < screenWidth; at += 16)
    block(
      context,
      colour.snowDark,
      wrap(at - px(state.distance), screenWidth),
      groundY + 8,
      6,
      1,
    );
}

function rocks(context: CanvasRenderingContext2D, state: SnowballState): void {
  for (const rock of state.rocks) {
    const x = ballX + px(rock - state.distance);
    if (x < -px(rockWidth) || x > screenWidth) continue;
    const width = px(rockWidth);
    const height = px(rockHeight);
    block(context, colour.rock, x, groundY - height, width, height);
    block(context, colour.rockDark, x, groundY - 1, width, 1);
    block(context, colour.snow, x, groundY - height, width - 1, 1);
  }
}

function snowball(
  context: CanvasRenderingContext2D,
  state: SnowballState,
): void {
  const size = px(ballWidth) + 3;
  const lift = px(heightAt(state.air));
  const y = groundY - size - lift;
  block(context, colour.shadow, ballX, groundY, size, 1);
  block(context, colour.ball, ballX, y, size, size);
  block(context, colour.ballShade, ballX, y + size - 2, size, 2);
  block(context, colour.cyan, ballX + 2 + (state.tick % 3), y + 2, 2, 1);
}

// The progress bar along the top is how much of the slope is behind the snowball.
function progressBar(
  context: CanvasRenderingContext2D,
  state: SnowballState,
): void {
  const done = Math.floor(
    (Math.min(state.distance, courseUnits) * (screenWidth - 8)) / courseUnits,
  );
  block(context, colour.shadow, 4, 2, screenWidth - 8, 2);
  block(context, colour.yellow, 4, 2, done, 2);
}

export function draw(
  context: CanvasRenderingContext2D,
  state: SnowballState,
): void {
  backdrop(context, state);
  rocks(context, state);
  snowball(context, state);
  progressBar(context, state);
  if (!state.alive)
    block(context, colour.flash, 0, 0, screenWidth, screenHeight);
}
